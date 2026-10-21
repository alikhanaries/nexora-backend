import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, ValidationError, } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { createCustomerSnapshotEntity } from '../models/customer-snapshot.js';
import { createOrderLineEntity } from '../models/order-line.js';
import { createOrderEntity } from '../models/order.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from '../views/order-dto.js';
import { orderCreatedEvent, orderConfirmedEvent } from './order-events.js';
import { requireOrdersCreate } from './order-permissions.js';
import { assignOrderCompatibilityExternalIds } from './assign-order-compatibility-external-ids.js';
import { resolveOrderLines } from './resolve-order-lines.js';

const ORDER_REFERENCE_TYPE = 'ORDER';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateOrder(deps) {
    /**
     * Order command/query step: tenant isolation on all repository calls; may emit order.* events for outbound webhooks.
     */
    async function execute(input) {
        requireOrdersCreate(deps.authorization, input.actorPermissions);
        if (input.lines.length === 0) {
            throw new ValidationError('Order must contain at least one line');
        }
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
        const orderId = randomUUID();
        const resolvedLines = await deps.database.withTenant(input.tenantId, (tx) =>
            resolveOrderLines(deps, {
                tenantId: input.tenantId,
                channelId: input.channelId,
                currency,
                lines: input.lines,
                transaction: tx,
            }));
        const subtotalMinor = resolvedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
        const totalMinor = subtotalMinor - discountMinor + taxMinor + shippingMinor;
        if (totalMinor < 0) {
            throw new BusinessRuleError('Order total cannot be negative');
        }
        const externalOrderReference = input.externalOrderReference === undefined || input.externalOrderReference === null
            ? null
            : input.externalOrderReference.trim() || null;
        /**
         * Transactional body run inside idempotency or database.execute (same tenant throughout).
         */
        const work = async (tx) => {
            for (const line of resolvedLines) {
                await deps.inventoryService.reserve({
                    tenantId: input.tenantId,
                    stockLocationId: line.input.stockLocationId,
                    productId: line.productId,
                    quantity: line.input.quantity,
                    referenceType: ORDER_REFERENCE_TYPE,
                    referenceId: orderId,
                }, tx);
            }
            const orderNumber = await deps.orders.allocateOrderNumber(tx, input.tenantId);
            const now = new Date();
            const order = createOrderEntity({
                id: orderId,
                tenantId: input.tenantId,
                channelId: input.channelId,
                externalOrderReference,
                orderNumber,
                currency,
                subtotalMinor,
                discountMinor,
                taxMinor,
                shippingMinor,
                totalMinor,
                createdAt: now,
            });
            await deps.orders.insertOrder(tx, order);
            const orderLines = [];
            for (const line of resolvedLines) {
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
                    currency,
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
                    lineCount: orderLines.length,
                    totalMinor: order.totalMinor,
                    currency: order.currency,
                },
                ...auditRequestFields(),
            });
            return {
                ...orderDto,
                lines: orderLines.map(toOrderLineDto),
                customer: toCustomerSnapshotDto(snapshot),
            };
        };
        const detail = input.transaction !== undefined
            ? await work(input.transaction)
            : await deps.database.execute(work, { tenantId: input.tenantId });
        return { order: detail };
    }

    return { execute };
}
