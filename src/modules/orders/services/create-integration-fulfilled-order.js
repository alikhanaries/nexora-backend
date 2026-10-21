/**
 * Creates orders already fulfilled by an external commerce integration (channel-fulfilled ingest).
 */
import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { AppError, BusinessRuleError, ConflictError, ValidationError, } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { createCustomerSnapshotEntity } from '../models/customer-snapshot.js';
import { createOrderLineEntity } from '../models/order-line.js';
import { createOrderEntity } from '../models/order.js';
import { OrderStatus } from '../models/order-status.js';
import { assignOrderCompatibilityExternalIds } from './assign-order-compatibility-external-ids.js';
import { isEquivalentChannelFulfilledOrderRequest } from './channel-fulfilled-order-request-equivalence.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from '../views/order-dto.js';
import { orderConfirmedEvent, orderCreatedEvent } from './order-events.js';
import { requireOrdersIngestChannelFulfilled } from './order-permissions.js';
import { resolveOrderLines } from './resolve-order-lines.js';

const EXTERNAL_REF_UNIQUE_CONSTRAINT = 'orders_tenant_channel_external_ref_unique';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateIntegrationFulfilledOrder(deps) {
    /**
     * @param {import('../models/order.js').Order} order
     * @param {import('../models/order-line.js').OrderLine[]} lines
     * @param {import('../models/customer-snapshot.js').CustomerSnapshot|null} customer
     */
    function toOrderDetail(order, lines, customer) {
        return {
            ...toOrderDto(order),
            lines: lines.map(toOrderLineDto),
            customer: customer === null ? null : toCustomerSnapshotDto(customer),
        };
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../models/order.js').Order} existing
     * @param {object[]} resolvedLines
     * @param {string} currency
     * @param {number} discountMinor
     * @param {number} taxMinor
     * @param {number} shippingMinor
     */
    async function resolveExistingChannelFulfilledOrder(tx, input, existing, resolvedLines, currency, discountMinor, taxMinor, shippingMinor) {
        const existingLines = await deps.orders.listOrderLines(tx, input.tenantId, existing.id);
        const existingCustomer = await deps.orders.findCustomerSnapshot(tx, input.tenantId, existing.id);
        const existingShipments = await deps.listShipmentsForOrder(tx, input.tenantId, existing.id);
        const existingShipment = existingShipments[0] ?? null;
        const equivalent = isEquivalentChannelFulfilledOrderRequest(
            existing,
            existingLines,
            existingCustomer,
            existingShipment,
            {
                ...input,
                currency,
                discountMinor,
                taxMinor,
                shippingMinor,
            },
            resolvedLines,
        );
        if (!equivalent) {
            throw new ConflictError('Channel order external reference was reused with a different request', {
                externalOrderReference: existing.externalOrderReference,
                channelId: input.channelId,
            });
        }
        return {
            order: toOrderDetail(existing, existingLines, existingCustomer),
            shipment: existingShipment,
        };
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {object} prepared
     */
    async function createNewChannelFulfilledOrder(tx, input, prepared) {
        const orderId = randomUUID();
        const orderNumber = await deps.orders.allocateOrderNumber(tx, input.tenantId);
        const now = new Date();
        const order = createOrderEntity({
            id: orderId,
            tenantId: input.tenantId,
            channelId: input.channelId,
            externalOrderReference: prepared.externalOrderReference,
            orderNumber,
            status: OrderStatus.CONFIRMED,
            currency: prepared.currency,
            subtotalMinor: prepared.subtotalMinor,
            discountMinor: prepared.discountMinor,
            taxMinor: prepared.taxMinor,
            shippingMinor: prepared.shippingMinor,
            totalMinor: prepared.totalMinor,
            createdAt: now,
        });
        try {
            await deps.orders.insertOrder(tx, order);
        }
        catch (error) {
            if (isExternalReferenceUniqueViolation(error)) {
                const raced = await deps.orders.lockByChannelAndExternalReferenceForUpdate(
                    tx,
                    input.tenantId,
                    input.channelId,
                    prepared.externalOrderReference,
                );
                if (raced !== null) {
                    return resolveExistingChannelFulfilledOrder(
                        tx,
                        input,
                        raced,
                        prepared.resolvedLines,
                        prepared.currency,
                        prepared.discountMinor,
                        prepared.taxMinor,
                        prepared.shippingMinor,
                    );
                }
            }
            throw error;
        }
        const orderLines = [];
        for (const line of prepared.resolvedLines) {
            const orderLine = createOrderLineEntity({
                id: randomUUID(),
                tenantId: input.tenantId,
                orderId,
                productId: line.productId,
                offerId: line.offerId,
                stockLocationId: line.input.stockLocationId,
                merchantSku: line.merchantSku,
                productTypeSnapshot: line.productTypeSnapshot,
                quantity: line.input.quantity,
                unitPriceMinor: line.unitPriceMinor,
                discountMinor: 0,
                taxMinor: 0,
                lineTotalMinor: line.lineTotalMinor,
                currency: prepared.currency,
            });
            await deps.orders.insertOrderLine(tx, orderLine);
            orderLines.push(orderLine);
        }
        const customerInput = input.customer ?? {};
        const snapshot = createCustomerSnapshotEntity({
            id: randomUUID(),
            tenantId: input.tenantId,
            orderId,
            externalCustomerReference: customerInput.externalCustomerReference?.trim() || null,
            firstName: customerInput.firstName?.trim() || null,
            lastName: customerInput.lastName?.trim() || null,
            email: customerInput.email?.trim() || null,
            phone: customerInput.phone?.trim() || null,
            companyName: customerInput.companyName?.trim() || null,
            billingAddress: customerInput.billingAddress ?? null,
            shippingAddress: customerInput.shippingAddress ?? null,
            metadata: customerInput.metadata ?? {},
        });
        await deps.orders.insertCustomerSnapshot(tx, snapshot);
        await assignOrderCompatibilityExternalIds(
            deps.externalIntegerIdMappingCommandService,
            tx,
            input.tenantId,
            order.id,
            orderLines,
        );
        const orderDto = toOrderDto(order);
        await deps.eventRecorder.record(tx, orderCreatedEvent(orderDto));
        await deps.eventRecorder.record(tx, orderConfirmedEvent(orderDto));
        await deps.auditRecorder?.record(tx, {
            tenantId: input.tenantId,
            actorKind: input.actorKind,
            actorId: input.actorId,
            eventType: 'ORDER_CREATED',
            resourceType: 'order',
            resourceId: order.id,
            metadata: {
                orderNumber: order.orderNumber,
                channelId: order.channelId,
                externalOrderReference: order.externalOrderReference,
                lineCount: orderLines.length,
                totalMinor: order.totalMinor,
                currency: order.currency,
                ingestionKind: 'channel_fulfilled',
            },
            ...auditRequestFields(),
        });
        const shipmentInput = input.shipment ?? {};
        const shipmentLines = orderLines.map((line) => ({
            orderLineId: line.id,
            quantity: line.quantity,
        }));
        const { shipment: createdShipment } = await deps.createShipment.execute({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            orderId,
            lines: shipmentLines,
            carrier: shipmentInput.carrier ?? null,
            service: shipmentInput.service ?? null,
            trackingNumber: shipmentInput.trackingNumber ?? null,
            externalReference: shipmentInput.externalReference ?? null,
            skipAuthorization: true,
            transaction: tx,
        });
        const { shipment } = await deps.shipShipment.execute({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            shipmentId: createdShipment.id,
            carrier: shipmentInput.carrier,
            trackingNumber: shipmentInput.trackingNumber,
            skipAuthorization: true,
            inventoryConsumptionMode: 'record_sale_only',
            transaction: tx,
        });
        const refreshedOrder = await deps.orders.findById(tx, input.tenantId, orderId);
        const refreshedLines = await deps.orders.listOrderLines(tx, input.tenantId, orderId);
        return {
            order: toOrderDetail(refreshedOrder ?? order, refreshedLines, snapshot),
            shipment,
        };
    }

    /**
     * Order command/query step: tenant isolation on all repository calls; may emit order.* events for outbound webhooks.
     */
    async function execute(input) {
        requireOrdersIngestChannelFulfilled(deps.authorization, input.actorPermissions);
        if (input.lines.length === 0) {
            throw new ValidationError('Order must contain at least one line');
        }
        const externalOrderReference = normalizeRequiredExternalReference(input.externalOrderReference);
        const currency = parseCurrency(input.currency);
        const discountMinor = input.discountMinor ?? 0;
        const taxMinor = input.taxMinor ?? 0;
        const shippingMinor = input.shippingMinor ?? 0;
        if (!Number.isInteger(discountMinor) || discountMinor < 0) {
            throw new ValidationError('Discount must be a non-negative integer');
        }
        if (!Number.isInteger(taxMinor) || taxMinor < 0) {
            throw new ValidationError('Tax must be a non-negative integer');
        }
        if (!Number.isInteger(shippingMinor) || shippingMinor < 0) {
            throw new ValidationError('Shipping must be a non-negative integer');
        }
        await deps.commerceIntegrationQueryService.verifyChannelUsable(input.tenantId, input.channelId);
        const resolvedLines = await deps.database.withTenant(input.tenantId, (tx) =>
            resolveOrderLines(deps, {
                tenantId: input.tenantId,
                channelId: input.channelId,
                currency,
                lines: input.lines,
                transaction: tx,
            }, { skuFirst: true }));
        const subtotalMinor = resolvedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
        const totalMinor = subtotalMinor - discountMinor + taxMinor + shippingMinor;
        if (totalMinor < 0) {
            throw new BusinessRuleError('Order total cannot be negative');
        }
        /**
         * Transactional body run inside idempotency or database.execute (same tenant throughout).
         */
        const work = async (tx) => {
            const existing = await deps.orders.findByChannelAndExternalReference(
                tx,
                input.tenantId,
                input.channelId,
                externalOrderReference,
            );
            if (existing !== null) {
                return resolveExistingChannelFulfilledOrder(
                    tx,
                    input,
                    existing,
                    resolvedLines,
                    currency,
                    discountMinor,
                    taxMinor,
                    shippingMinor,
                );
            }
            const lockedExisting = await deps.orders.lockByChannelAndExternalReferenceForUpdate(
                tx,
                input.tenantId,
                input.channelId,
                externalOrderReference,
            );
            if (lockedExisting !== null) {
                return resolveExistingChannelFulfilledOrder(
                    tx,
                    input,
                    lockedExisting,
                    resolvedLines,
                    currency,
                    discountMinor,
                    taxMinor,
                    shippingMinor,
                );
            }
            return createNewChannelFulfilledOrder(tx, input, {
                externalOrderReference,
                currency,
                discountMinor,
                taxMinor,
                shippingMinor,
                subtotalMinor,
                totalMinor,
                resolvedLines,
            });
        };
        const detail = input.transaction !== undefined
            ? await work(input.transaction)
            : await deps.database.execute(work, { tenantId: input.tenantId });
        return detail;
    }

    return { execute };
}

/**
 * @param {string|null|undefined} value
 */
function normalizeRequiredExternalReference(value) {
    if (value === undefined || value === null) {
        throw new ValidationError('External order reference is required');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new ValidationError('External order reference is required');
    }
    return trimmed;
}

/**
 * @param {unknown} error
 */
function isExternalReferenceUniqueViolation(error) {
    if (!AppError.isAppError(error) || !(error instanceof ConflictError)) {
        return false;
    }
    const details = error.safeDetails;
    if (typeof details !== 'object' || details === null) {
        return false;
    }
    return details.constraint === EXTERNAL_REF_UNIQUE_CONSTRAINT;
}
