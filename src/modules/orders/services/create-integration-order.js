import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { AppError, BusinessRuleError, ConflictError, ValidationError, } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { createCustomerSnapshotEntity } from '../models/customer-snapshot.js';
import { createOrderLineEntity } from '../models/order-line.js';
import { createOrderEntity } from '../models/order.js';
import { OrderStatus } from '../models/order-status.js';
import { assignOrderCompatibilityExternalIds } from './assign-order-compatibility-external-ids.js';
import { isEquivalentChannelOrderRequest } from './channel-order-request-equivalence.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from '../views/order-dto.js';
import { orderCreatedEvent } from './order-events.js';
import { requireOrdersIngest } from './order-permissions.js';
import { resolveOrderLines } from './resolve-order-lines.js';

const ORDER_REFERENCE_TYPE = 'ORDER';
const EXTERNAL_REF_UNIQUE_CONSTRAINT = 'orders_tenant_channel_external_ref_unique';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateIntegrationOrder(deps) {
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
     * @param {object} input
     * @param {string} currency
     * @param {{ skuFirst?: boolean }} [options]
     */
    async function resolveOrderLinesInTenantScope(input, currency, options = {}) {
        const payload = {
            tenantId: input.tenantId,
            channelId: input.channelId,
            currency,
            lines: input.lines,
        };
        if (input.transaction !== undefined) {
            return resolveOrderLines(deps, { ...payload, transaction: input.transaction }, options);
        }
        return deps.database.withTenant(input.tenantId, (tx) =>
            resolveOrderLines(deps, { ...payload, transaction: tx }, options));
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
    async function resolveExistingChannelOrder(tx, input, existing, resolvedLines, currency, discountMinor, taxMinor, shippingMinor) {
        const existingLines = await deps.orders.listOrderLines(tx, input.tenantId, existing.id);
        const existingCustomer = await deps.orders.findCustomerSnapshot(tx, input.tenantId, existing.id);
        const equivalent = isEquivalentChannelOrderRequest(existing, existingLines, existingCustomer, {
            ...input,
            currency,
            discountMinor,
            taxMinor,
            shippingMinor,
        }, resolvedLines);
        if (!equivalent) {
            throw new ConflictError('Channel order external reference was reused with a different request', {
                externalOrderReference: existing.externalOrderReference,
                channelId: input.channelId,
            });
        }
        return {
            ...toOrderDetail(existing, existingLines, existingCustomer),
            ingestionOutcome: 'duplicate',
        };
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {object} prepared
     */
    async function createNewChannelOrder(tx, input, prepared) {
        const orderId = randomUUID();
        for (const line of prepared.resolvedLines) {
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
            externalOrderReference: prepared.externalOrderReference,
            orderNumber,
            status: OrderStatus.NEW,
            currency: prepared.currency,
            subtotalMinor: prepared.subtotalMinor,
            discountMinor: prepared.discountMinor,
            taxMinor: prepared.taxMinor,
            shippingMinor: prepared.shippingMinor,
            totalMinor: prepared.totalMinor,
            createdAt: now,
        });
        const insertSavepoint = 'create_channel_order_insert';
        await tx.query(`SAVEPOINT ${insertSavepoint}`, [], { operation: 'orders.create_channel.savepoint' });
        try {
            await deps.orders.insertOrder(tx, order);
            await tx.query(`RELEASE SAVEPOINT ${insertSavepoint}`, [], { operation: 'orders.create_channel.release_savepoint' });
        }
        catch (error) {
            if (isExternalReferenceUniqueViolation(error)) {
                await tx.query(`ROLLBACK TO SAVEPOINT ${insertSavepoint}`, [], { operation: 'orders.create_channel.rollback_savepoint' });
                const raced = await deps.orders.lockByChannelAndExternalReferenceForUpdate(tx, input.tenantId, input.channelId, prepared.externalOrderReference);
                if (raced !== null) {
                    return resolveExistingChannelOrder(tx, input, raced, prepared.resolvedLines, prepared.currency, prepared.discountMinor, prepared.taxMinor, prepared.shippingMinor);
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
                ingestionKind: 'channel',
            },
            ...auditRequestFields(),
        });
        return {
            ...orderDto,
            lines: orderLines.map(toOrderLineDto),
            customer: toCustomerSnapshotDto(snapshot),
            ingestionOutcome: 'created',
        };
    }

    /**
     * Order command/query step: tenant isolation on all repository calls; may emit order.* events for outbound webhooks.
     */
    async function execute(input) {
        requireOrdersIngest(deps.authorization, input.actorPermissions);
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
        const resolvedLines = await resolveOrderLinesInTenantScope(input, currency, { skuFirst: true });
        const subtotalMinor = resolvedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
        const totalMinor = subtotalMinor - discountMinor + taxMinor + shippingMinor;
        if (totalMinor < 0) {
            throw new BusinessRuleError('Order total cannot be negative');
        }
        /**
         * Transactional body run inside idempotency or database.execute (same tenant throughout).
         */
        const work = async (tx) => {
            await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                `channel-order:${input.tenantId}:${input.channelId}:${externalOrderReference}`,
            ], { operation: 'orders.advisory_channel_external_ref' });
            const existing = await deps.orders.findByChannelAndExternalReference(tx, input.tenantId, input.channelId, externalOrderReference);
            if (existing !== null) {
                return resolveExistingChannelOrder(tx, input, existing, resolvedLines, currency, discountMinor, taxMinor, shippingMinor);
            }
            const lockedExisting = await deps.orders.lockByChannelAndExternalReferenceForUpdate(tx, input.tenantId, input.channelId, externalOrderReference);
            if (lockedExisting !== null) {
                return resolveExistingChannelOrder(tx, input, lockedExisting, resolvedLines, currency, discountMinor, taxMinor, shippingMinor);
            }
            return createNewChannelOrder(tx, input, {
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
        const { ingestionOutcome, ...order } = detail;
        return {
            order,
            ingestionOutcome: ingestionOutcome ?? 'created',
        };
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
