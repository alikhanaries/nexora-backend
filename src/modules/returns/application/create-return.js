import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { Return } from '../domain/return.js';
import { ReturnLine } from '../domain/return-line.js';
import { toReturnDetailDto } from './return-dto.js';
import { returnCreatedEvent } from './return-events.js';
import { requireReturnsCreate } from './return-permissions.js';
export class CreateReturn {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireReturnsCreate(this.deps.authorization, input.actorPermissions);
        if (input.lines.length === 0) {
            throw new ValidationError('Return must contain at least one line');
        }
        const returnDetail = await this.deps.database.execute(async (tx) => {
            const order = await this.deps.orders.findOrder(tx, input.tenantId, input.orderId);
            if (order === null) {
                throw new NotFoundError('Order was not found', {
                    tenantId: input.tenantId,
                    orderId: input.orderId,
                });
            }
            const shipmentId = input.shipmentId === undefined || input.shipmentId === null ? null : input.shipmentId;
            if (shipmentId !== null) {
                const valid = await this.deps.returns.verifyShipmentBelongsToOrder(tx, input.tenantId, input.orderId, shipmentId);
                if (!valid) {
                    throw new NotFoundError('Shipment was not found for this order', {
                        tenantId: input.tenantId,
                        orderId: input.orderId,
                        shipmentId,
                    });
                }
            }
            const orderLines = await this.deps.orders.lockOrderLinesForUpdate(tx, input.tenantId, input.orderId);
            const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
            const orderLineIds = input.lines.map((line) => line.orderLineId);
            const pendingByLine = await this.deps.returns.sumPendingQuantitiesByOrderLine(tx, input.tenantId, input.orderId, orderLineIds);
            const returnId = randomUUID();
            const now = new Date();
            const returnLines = [];
            for (const lineInput of input.lines) {
                if (!Number.isInteger(lineInput.quantity) || lineInput.quantity <= 0) {
                    throw new ValidationError('Return line quantity must be a positive integer');
                }
                const orderLine = orderLineById.get(lineInput.orderLineId);
                if (orderLine === undefined) {
                    throw new NotFoundError('Order line was not found on this order', {
                        orderId: input.orderId,
                        orderLineId: lineInput.orderLineId,
                    });
                }
                const pendingQuantity = pendingByLine.get(lineInput.orderLineId) ?? 0;
                const eligibleQuantity = orderLine.shippedQuantity - orderLine.returnedQuantity - pendingQuantity;
                if (lineInput.quantity > eligibleQuantity) {
                    throw new BusinessRuleError('Return quantity exceeds eligible amount for order line', {
                        orderLineId: lineInput.orderLineId,
                        requestedQuantity: lineInput.quantity,
                        eligibleQuantity,
                        shippedQuantity: orderLine.shippedQuantity,
                        returnedQuantity: orderLine.returnedQuantity,
                        pendingQuantity,
                    });
                }
                const reason = lineInput.reason === undefined || lineInput.reason === null
                    ? null
                    : lineInput.reason.trim() || null;
                returnLines.push(ReturnLine.create({
                    id: randomUUID(),
                    tenantId: input.tenantId,
                    returnId,
                    orderLineId: lineInput.orderLineId,
                    quantity: lineInput.quantity,
                    reason,
                    createdAt: now,
                }));
            }
            const reason = input.reason === undefined || input.reason === null ? null : input.reason.trim() || null;
            const returnEntity = Return.create({
                id: returnId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                shipmentId,
                reason,
                createdAt: now,
            });
            await this.deps.returns.insertReturn(tx, returnEntity);
            for (const line of returnLines) {
                await this.deps.returns.insertReturnLine(tx, line);
            }
            const detail = toReturnDetailDto(returnEntity, returnLines);
            await this.deps.eventRecorder.record(tx, returnCreatedEvent(detail));
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'RETURN_CREATED',
                resourceType: 'return',
                resourceId: returnEntity.id,
                metadata: {
                    orderId: returnEntity.orderId,
                    shipmentId: returnEntity.shipmentId,
                    lineCount: returnLines.length,
                },
                ...auditRequestFields(),
            });
            return detail;
        }, { tenantId: input.tenantId });
        return { return: returnDetail };
    }
}
