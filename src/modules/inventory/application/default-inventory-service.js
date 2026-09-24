import { randomUUID } from 'node:crypto';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../shared/errors/index.js';
import { MovementType } from '../domain/movement-type.js';
import { ReservationStatus } from '../domain/reservation-status.js';
import { INVENTORY_AGGREGATE_TYPE, INVENTORY_EVENT_TYPES, INVENTORY_EVENT_VERSION, } from './inventory-events.js';
import { optionalReferenceFields } from './optional-fields.js';

const ORDER_REFERENCE_TYPE = 'ORDER';
const SHIPMENT_REFERENCE_TYPE = 'SHIPMENT';

export class DefaultInventoryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async verifyUsableStockLocation(tenantId, stockLocationId, tx) {
        if (tx !== undefined) {
            await this.assertActiveStockLocation(tx, tenantId, stockLocationId);
            return;
        }
        await this.runInTransaction(tenantId, undefined, (transaction) => this.assertActiveStockLocation(transaction, tenantId, stockLocationId));
    }
    async getAvailability(tenantId, productId, stockLocationId, tx) {
        await this.assertProductExists(tenantId, productId, tx);
        const queryable = tx ?? this.deps.queryable;
        const balances = await this.deps.inventoryRepository.listBalances(queryable, tenantId, {
            productId,
            ...(stockLocationId === undefined ? {} : { stockLocationId }),
        });
        const locations = balances.map((balance) => ({
            stockLocationId: balance.stockLocationId,
            onHand: balance.onHand,
            reserved: balance.reserved,
            available: balance.available,
        }));
        const totals = locations.reduce((acc, location) => ({
            onHand: acc.onHand + location.onHand,
            reserved: acc.reserved + location.reserved,
            available: acc.available + location.available,
        }), { onHand: 0, reserved: 0, available: 0 });
        return {
            tenantId,
            productId,
            locations,
            totals,
        };
    }
    async reserve(input, tx) {
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.reserveInTransaction(transaction, input));
    }
    async release(input, tx) {
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.releaseInTransaction(transaction, input));
    }
    async fulfillReservedForShipment(input, tx) {
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.fulfillReservedForShipmentInTransaction(transaction, input));
    }
    async adjust(input, tx) {
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.mutateOnHand(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            delta: input.delta,
            movementType: MovementType.ADJUSTMENT,
            ...optionalReferenceFields(input),
            auditEventType: 'INVENTORY_ADJUSTED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_CHANGED,
        }));
    }
    async receive(input, tx) {
        if (input.quantity <= 0) {
            throw new BusinessRuleError('Receive quantity must be positive');
        }
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.mutateOnHand(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            delta: input.quantity,
            movementType: MovementType.RECEIPT,
            ...optionalReferenceFields(input),
            auditEventType: 'INVENTORY_RECEIVED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_CHANGED,
        }));
    }
    async recordSale(input, tx) {
        if (input.quantity <= 0) {
            throw new BusinessRuleError('Sale quantity must be positive');
        }
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.mutateOnHand(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            delta: -input.quantity,
            movementType: MovementType.SALE,
            ...optionalReferenceFields(input),
            auditEventType: 'INVENTORY_SALE_RECORDED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_CHANGED,
        }));
    }
    async recordReturn(input, tx) {
        if (input.quantity <= 0) {
            throw new BusinessRuleError('Return quantity must be positive');
        }
        return this.runInTransaction(input.tenantId, tx, (transaction) => this.mutateOnHand(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            delta: input.quantity,
            movementType: MovementType.RETURN,
            ...optionalReferenceFields(input),
            auditEventType: 'INVENTORY_RETURN_RECORDED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_CHANGED,
        }));
    }
    async runInTransaction(tenantId, tx, work) {
        if (tx !== undefined) {
            return work(tx);
        }
        return this.deps.transactionManager.execute(work, { tenantId });
    }
    async reserveInTransaction(transaction, input) {
        if (input.quantity <= 0) {
            throw new BusinessRuleError('Reservation quantity must be positive');
        }
        await this.assertProductExists(input.tenantId, input.productId, transaction);
        await this.assertActiveStockLocation(transaction, input.tenantId, input.stockLocationId);
        const reservationInsert = await this.deps.inventoryRepository.insertReservation(transaction, {
            id: randomUUID(),
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            quantity: input.quantity,
        });
        const reservation = reservationInsert.reservation;
        if (!reservationInsert.inserted) {
            if (reservation.status === ReservationStatus.RELEASED) {
                throw new BusinessRuleError('Reservation reference was already released', {
                    referenceType: input.referenceType,
                    referenceId: input.referenceId,
                });
            }
            if (reservation.quantity !== input.quantity) {
                throw new ConflictError('Reservation reference exists with a different quantity', {
                    referenceType: input.referenceType,
                    referenceId: input.referenceId,
                    existingQuantity: reservation.quantity,
                    requestedQuantity: input.quantity,
                });
            }
            const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
            return {
                reservationId: reservation.id,
                idempotent: true,
                balance: this.toBalanceSnapshot(balance),
            };
        }
        const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
        if (balance.available < input.quantity) {
            throw new BusinessRuleError('Insufficient inventory to reserve', {
                productId: input.productId,
                stockLocationId: input.stockLocationId,
                available: balance.available,
                requested: input.quantity,
            });
        }
        const reserved = balance.reserved + input.quantity;
        const available = balance.onHand - reserved;
        const updatedAt = new Date();
        await this.deps.inventoryRepository.updateBalance(transaction, balance.id, { onHand: balance.onHand, reserved, available }, updatedAt);
        await this.insertMovementIfNew(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            movementType: MovementType.RESERVATION,
            quantity: input.quantity,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
        });
        await this.recordSideEffects(transaction, {
            tenantId: input.tenantId,
            aggregateId: balance.id,
            auditEventType: 'INVENTORY_RESERVED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_RESERVED,
            resourceId: reservation.id,
            metadata: {
                productId: input.productId,
                stockLocationId: input.stockLocationId,
                quantity: input.quantity,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
            },
            balanceSnapshot: { onHand: balance.onHand, reserved, available },
        });
        return {
            reservationId: reservation.id,
            idempotent: false,
            balance: { onHand: balance.onHand, reserved, available },
        };
    }
    async releaseInTransaction(transaction, input) {
        await this.assertProductExists(input.tenantId, input.productId, transaction);
        await this.assertActiveStockLocation(transaction, input.tenantId, input.stockLocationId);
        const reservation = await this.deps.inventoryRepository.findReservationByReference(transaction, input.tenantId, input.referenceType, input.referenceId, input.stockLocationId, input.productId);
        if (reservation === null) {
            throw new NotFoundError('Inventory reservation was not found', {
                referenceType: input.referenceType,
                referenceId: input.referenceId,
            });
        }
        if (reservation.isReleased()) {
            const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
            return {
                reservationId: reservation.id,
                idempotent: true,
                balance: this.toBalanceSnapshot(balance),
            };
        }
        const releaseQuantity = input.quantity ?? reservation.quantity;
        if (releaseQuantity <= 0) {
            throw new BusinessRuleError('Release quantity must be positive');
        }
        if (releaseQuantity > reservation.quantity) {
            throw new BusinessRuleError('Cannot release more than the reserved quantity', {
                reservedQuantity: reservation.quantity,
                requestedRelease: releaseQuantity,
            });
        }
        const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
        if (balance.reserved < releaseQuantity) {
            throw new BusinessRuleError('Cannot release more than the current reserved balance', {
                reserved: balance.reserved,
                requestedRelease: releaseQuantity,
            });
        }
        const reserved = balance.reserved - releaseQuantity;
        const available = balance.onHand - reserved;
        const updatedAt = new Date();
        await this.deps.inventoryRepository.updateBalance(transaction, balance.id, { onHand: balance.onHand, reserved, available }, updatedAt);
        await this.insertMovementIfNew(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            movementType: MovementType.RELEASE,
            quantity: releaseQuantity,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
        });
        await this.deps.inventoryRepository.markReservationReleased(transaction, reservation.id, updatedAt);
        await this.recordSideEffects(transaction, {
            tenantId: input.tenantId,
            aggregateId: balance.id,
            auditEventType: 'INVENTORY_RELEASED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_RELEASED,
            resourceId: reservation.id,
            metadata: {
                productId: input.productId,
                stockLocationId: input.stockLocationId,
                quantity: releaseQuantity,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
            },
            balanceSnapshot: { onHand: balance.onHand, reserved, available },
        });
        return {
            reservationId: reservation.id,
            idempotent: false,
            balance: { onHand: balance.onHand, reserved, available },
        };
    }
    async fulfillReservedForShipmentInTransaction(transaction, input) {
        if (input.quantity <= 0) {
            throw new BusinessRuleError('Fulfillment quantity must be positive');
        }
        await this.assertProductExists(input.tenantId, input.productId, transaction);
        await this.assertActiveStockLocation(transaction, input.tenantId, input.stockLocationId);
        const existingMovement = await this.deps.inventoryRepository.findMovementByIdempotency(transaction, input.tenantId, SHIPMENT_REFERENCE_TYPE, input.shipmentId, MovementType.SALE, input.shipmentLineId);
        if (existingMovement !== null) {
            const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
            return {
                idempotent: true,
                balance: this.toBalanceSnapshot(balance),
            };
        }
        const reservation = await this.deps.inventoryRepository.findReservationByReference(transaction, input.tenantId, ORDER_REFERENCE_TYPE, input.orderId, input.stockLocationId, input.productId);
        if (reservation === null) {
            throw new NotFoundError('ORDER inventory reservation was not found for fulfillment', {
                orderId: input.orderId,
                productId: input.productId,
                stockLocationId: input.stockLocationId,
            });
        }
        if (reservation.isReleased()) {
            throw new BusinessRuleError('ORDER reservation was already released', {
                orderId: input.orderId,
                productId: input.productId,
            });
        }
        if (input.quantity > reservation.quantity) {
            throw new BusinessRuleError('Fulfillment quantity exceeds remaining reservation', {
                remainingReservation: reservation.quantity,
                requested: input.quantity,
            });
        }
        const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
        if (balance.reserved < input.quantity) {
            throw new BusinessRuleError('Insufficient reserved inventory to fulfill', {
                reserved: balance.reserved,
                requested: input.quantity,
            });
        }
        if (balance.onHand < input.quantity) {
            throw new BusinessRuleError('Insufficient on-hand inventory to fulfill', {
                onHand: balance.onHand,
                requested: input.quantity,
            });
        }
        const reserved = balance.reserved - input.quantity;
        const onHand = balance.onHand - input.quantity;
        const available = onHand - reserved;
        const updatedAt = new Date();
        await this.deps.inventoryRepository.updateBalance(transaction, balance.id, { onHand, reserved, available }, updatedAt);
        const remainingReservationQuantity = reservation.quantity - input.quantity;
        await this.deps.inventoryRepository.updateReservationQuantity(transaction, reservation.id, remainingReservationQuantity, updatedAt);
        await this.insertMovementIfNew(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            movementType: MovementType.SALE,
            quantity: input.quantity,
            referenceType: SHIPMENT_REFERENCE_TYPE,
            referenceId: input.shipmentId,
            idempotencyKey: input.shipmentLineId,
            metadata: {
                orderId: input.orderId,
                orderLineId: input.orderLineId,
            },
        });
        await this.recordSideEffects(transaction, {
            tenantId: input.tenantId,
            aggregateId: balance.id,
            auditEventType: 'INVENTORY_SALE_RECORDED',
            outboxEventType: INVENTORY_EVENT_TYPES.INVENTORY_CHANGED,
            resourceId: balance.id,
            metadata: {
                productId: input.productId,
                stockLocationId: input.stockLocationId,
                quantity: input.quantity,
                referenceType: SHIPMENT_REFERENCE_TYPE,
                referenceId: input.shipmentId,
                orderId: input.orderId,
                orderLineId: input.orderLineId,
                fulfillment: 'shipment',
            },
            balanceSnapshot: { onHand, reserved, available },
        });
        return {
            idempotent: false,
            balance: { onHand, reserved, available },
        };
    }
    async mutateOnHand(transaction, input) {
        if (input.delta === 0) {
            throw new BusinessRuleError('Inventory delta must be non-zero');
        }
        await this.assertProductExists(input.tenantId, input.productId, transaction);
        await this.assertActiveStockLocation(transaction, input.tenantId, input.stockLocationId);
        const balance = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
        const onHand = balance.onHand + input.delta;
        const available = onHand - balance.reserved;
        if (onHand < 0 || available < 0) {
            throw new BusinessRuleError('Inventory mutation would result in negative stock', {
                productId: input.productId,
                stockLocationId: input.stockLocationId,
                onHand,
                available,
            });
        }
        const updatedAt = new Date();
        await this.deps.inventoryRepository.updateBalance(transaction, balance.id, { onHand, reserved: balance.reserved, available }, updatedAt);
        const inserted = await this.insertMovementIfNew(transaction, {
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            movementType: input.movementType,
            quantity: Math.abs(input.delta),
            ...optionalReferenceFields(input),
            metadata: { ...(input.metadata ?? {}), delta: input.delta },
        });
        if (!inserted && input.idempotencyKey !== undefined) {
            const current = await this.deps.inventoryRepository.lockBalanceForUpdate(transaction, input.tenantId, input.stockLocationId, input.productId);
            return {
                idempotent: true,
                balance: this.toBalanceSnapshot(current),
            };
        }
        await this.recordSideEffects(transaction, {
            tenantId: input.tenantId,
            aggregateId: balance.id,
            auditEventType: input.auditEventType,
            outboxEventType: input.outboxEventType,
            resourceId: balance.id,
            metadata: {
                productId: input.productId,
                stockLocationId: input.stockLocationId,
                delta: input.delta,
                movementType: input.movementType,
            },
            balanceSnapshot: { onHand, reserved: balance.reserved, available },
        });
        return {
            idempotent: false,
            balance: { onHand, reserved: balance.reserved, available },
        };
    }
    async assertProductExists(tenantId, productId, tx) {
        const exists = await this.deps.productQueryService.verifyProductBelongsToTenant(tenantId, productId, tx);
        if (!exists) {
            throw new NotFoundError('Product was not found', { tenantId, productId });
        }
    }
    async assertActiveStockLocation(transaction, tenantId, stockLocationId) {
        const location = await this.deps.stockLocationRepository.findById(transaction, tenantId, stockLocationId);
        if (location === null) {
            throw new NotFoundError('Stock location was not found', { stockLocationId });
        }
        location.assertUsable();
    }
    async insertMovementIfNew(transaction, input) {
        return this.deps.inventoryRepository.insertMovement(transaction, {
            id: randomUUID(),
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            movementType: input.movementType,
            quantity: input.quantity,
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
        });
    }
    async recordSideEffects(transaction, input) {
        if (this.deps.auditRecorder !== undefined) {
            await this.deps.auditRecorder.record(transaction, {
                tenantId: input.tenantId,
                actorKind: 'system',
                eventType: input.auditEventType,
                resourceType: 'inventory_balance',
                resourceId: input.resourceId,
                metadata: input.metadata,
            });
        }
        await this.deps.eventRecorder.record(transaction, {
            type: input.outboxEventType,
            version: INVENTORY_EVENT_VERSION,
            aggregateType: INVENTORY_AGGREGATE_TYPE,
            aggregateId: input.aggregateId,
            tenantId: input.tenantId,
            payload: {
                ...input.metadata,
                balance: input.balanceSnapshot,
            },
        });
    }
    toBalanceSnapshot(balance) {
        return {
            onHand: balance.onHand,
            reserved: balance.reserved,
            available: balance.available,
        };
    }
}
