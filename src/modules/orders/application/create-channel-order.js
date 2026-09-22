import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { AppError, BusinessRuleError, ConflictError, ValidationError, } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { CustomerSnapshot } from '../domain/customer-snapshot.js';
import { OrderLine } from '../domain/order-line.js';
import { Order } from '../domain/order.js';
import { OrderStatus } from '../domain/order-status.js';
import { isEquivalentChannelOrderRequest } from './channel-order-request-equivalence.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from './order-dto.js';
import { orderCreatedEvent } from './order-events.js';
import { requireOrdersIngest } from './order-permissions.js';
import { resolveOrderLines } from './resolve-order-lines.js';

const ORDER_REFERENCE_TYPE = 'ORDER';
const EXTERNAL_REF_UNIQUE_CONSTRAINT = 'orders_tenant_channel_external_ref_unique';

export class CreateChannelOrder {
    deps;

    constructor(deps) {
        this.deps = deps;
    }

    async execute(input) {
        requireOrdersIngest(this.deps.authorization, input.actorPermissions);
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
        await this.deps.channelQueryService.verifyChannelUsable(input.tenantId, input.channelId);
        const resolvedLines = await resolveOrderLines(this.deps, {
            tenantId: input.tenantId,
            channelId: input.channelId,
            currency,
            lines: input.lines,
        }, { skuFirst: true });
        const subtotalMinor = resolvedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
        const totalMinor = subtotalMinor - discountMinor + taxMinor + shippingMinor;
        if (totalMinor < 0) {
            throw new BusinessRuleError('Order total cannot be negative');
        }
        const work = async (tx) => {
            const existing = await this.deps.orders.findByChannelAndExternalReference(tx, input.tenantId, input.channelId, externalOrderReference);
            if (existing !== null) {
                return this.resolveExistingChannelOrder(tx, input, existing, resolvedLines, currency, discountMinor, taxMinor, shippingMinor);
            }
            const lockedExisting = await this.deps.orders.lockByChannelAndExternalReferenceForUpdate(tx, input.tenantId, input.channelId, externalOrderReference);
            if (lockedExisting !== null) {
                return this.resolveExistingChannelOrder(tx, input, lockedExisting, resolvedLines, currency, discountMinor, taxMinor, shippingMinor);
            }
            return this.createNewChannelOrder(tx, input, {
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
            : await this.deps.database.execute(work, { tenantId: input.tenantId });
        return { order: detail };
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../domain/order.js').Order} existing
     * @param {object[]} resolvedLines
     * @param {string} currency
     * @param {number} discountMinor
     * @param {number} taxMinor
     * @param {number} shippingMinor
     */
    async resolveExistingChannelOrder(tx, input, existing, resolvedLines, currency, discountMinor, taxMinor, shippingMinor) {
        const existingLines = await this.deps.orders.listOrderLines(tx, input.tenantId, existing.id);
        const existingCustomer = await this.deps.orders.findCustomerSnapshot(tx, input.tenantId, existing.id);
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
        return this.toOrderDetail(existing, existingLines, existingCustomer);
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {object} prepared
     */
    async createNewChannelOrder(tx, input, prepared) {
        const orderId = randomUUID();
        for (const line of prepared.resolvedLines) {
            await this.deps.inventoryService.reserve({
                tenantId: input.tenantId,
                stockLocationId: line.input.stockLocationId,
                productId: line.productId,
                quantity: line.input.quantity,
                referenceType: ORDER_REFERENCE_TYPE,
                referenceId: orderId,
            }, tx);
        }
        const orderNumber = await this.deps.orders.allocateOrderNumber(tx, input.tenantId);
        const now = new Date();
        const order = Order.create({
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
        try {
            await this.deps.orders.insertOrder(tx, order);
        }
        catch (error) {
            if (isExternalReferenceUniqueViolation(error)) {
                const raced = await this.deps.orders.lockByChannelAndExternalReferenceForUpdate(tx, input.tenantId, input.channelId, prepared.externalOrderReference);
                if (raced !== null) {
                    return this.resolveExistingChannelOrder(tx, input, raced, prepared.resolvedLines, prepared.currency, prepared.discountMinor, prepared.taxMinor, prepared.shippingMinor);
                }
            }
            throw error;
        }
        const orderLines = [];
        for (const line of prepared.resolvedLines) {
            const orderLine = OrderLine.create({
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
            await this.deps.orders.insertOrderLine(tx, orderLine);
            orderLines.push(orderLine);
        }
        const customerInput = input.customer ?? {};
        const snapshot = CustomerSnapshot.create({
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
        await this.deps.orders.insertCustomerSnapshot(tx, snapshot);
        const orderDto = toOrderDto(order);
        await this.deps.eventRecorder.record(tx, orderCreatedEvent(orderDto));
        await this.deps.auditRecorder?.record(tx, {
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
        };
    }

    /**
     * @param {import('../domain/order.js').Order} order
     * @param {import('../domain/order-line.js').OrderLine[]} lines
     * @param {import('../domain/customer-snapshot.js').CustomerSnapshot|null} customer
     */
    toOrderDetail(order, lines, customer) {
        return {
            ...toOrderDto(order),
            lines: lines.map(toOrderLineDto),
            customer: customer === null ? null : toCustomerSnapshotDto(customer),
        };
    }
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
