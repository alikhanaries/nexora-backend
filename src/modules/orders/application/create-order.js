import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError, } from '../../../shared/errors/index.js';
import { parseCurrency } from '../../../shared/money/index.js';
import { CustomerSnapshot } from '../domain/customer-snapshot.js';
import { OrderLine } from '../domain/order-line.js';
import { Order } from '../domain/order.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from './order-dto.js';
import { orderCreatedEvent, orderConfirmedEvent } from './order-events.js';
import { requireOrdersCreate } from './order-permissions.js';
const ORDER_REFERENCE_TYPE = 'ORDER';
export class CreateOrder {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireOrdersCreate(this.deps.authorization, input.actorPermissions);
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
        await this.deps.channelQueryService.verifyChannelUsable(input.tenantId, input.channelId);
        const orderId = randomUUID();
        const resolvedLines = [];
        for (const line of input.lines) {
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                throw new ValidationError('Line quantity must be a positive integer');
            }
            const product = await this.deps.productQueryService.getProductById(input.tenantId, line.productId);
            if (product === null) {
                throw new NotFoundError('Product was not found', {
                    tenantId: input.tenantId,
                    productId: line.productId,
                });
            }
            if (product.status !== 'ACTIVE') {
                throw new BusinessRuleError('Product is not active', { productId: line.productId });
            }
            let offerId = line.offerId ?? null;
            if (offerId !== null) {
                await this.deps.offerQueryService.verifyOfferUsable(input.tenantId, offerId);
            }
            else {
                const offer = await this.deps.offerQueryService.getOfferForProductAndChannel(input.tenantId, line.productId, input.channelId);
                if (offer !== null) {
                    if (offer.status !== 'ACTIVE') {
                        throw new BusinessRuleError('Offer is not usable for this product and channel', {
                            productId: line.productId,
                            channelId: input.channelId,
                        });
                    }
                    offerId = offer.id;
                }
            }
            const price = await this.deps.pricingService.getEffectivePrice(input.tenantId, line.productId, input.channelId, currency);
            if (price === null) {
                throw new NotFoundError('No effective price found for product and channel', {
                    productId: line.productId,
                    channelId: input.channelId,
                    currency,
                });
            }
            const lineTotalMinor = price.amountMinor * line.quantity;
            resolvedLines.push({
                input: line,
                merchantSku: product.merchantSku,
                productTypeSnapshot: product.productType,
                unitPriceMinor: price.amountMinor,
                lineTotalMinor,
                offerId,
            });
        }
        const subtotalMinor = resolvedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
        const totalMinor = subtotalMinor - discountMinor + taxMinor + shippingMinor;
        if (totalMinor < 0) {
            throw new BusinessRuleError('Order total cannot be negative');
        }
        const externalOrderReference = input.externalOrderReference === undefined || input.externalOrderReference === null
            ? null
            : input.externalOrderReference.trim() || null;
        const detail = await this.deps.database.execute(async (tx) => {
            if (externalOrderReference !== null) {
                const existing = await this.deps.orders.findById(tx, input.tenantId, orderId);
                if (existing !== null) {
                    throw new ConflictError('Order identifier conflict');
                }
            }
            for (const line of resolvedLines) {
                await this.deps.inventoryService.reserve({
                    tenantId: input.tenantId,
                    stockLocationId: line.input.stockLocationId,
                    productId: line.input.productId,
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
            await this.deps.orders.insertOrder(tx, order);
            const orderLines = [];
            for (const line of resolvedLines) {
                const orderLine = OrderLine.create({
                    id: randomUUID(),
                    tenantId: input.tenantId,
                    orderId,
                    productId: line.input.productId,
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
            await this.deps.eventRecorder.record(tx, orderConfirmedEvent(orderDto));
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
        }, { tenantId: input.tenantId });
        return { order: detail };
    }
}
