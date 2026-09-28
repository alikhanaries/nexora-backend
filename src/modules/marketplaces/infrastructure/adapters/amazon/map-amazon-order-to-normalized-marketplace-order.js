import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { parseCurrency } from '../../../../../shared/money/index.js';

/**
 * @param {unknown} orderPayload Orders API getOrder JSON or ORDER_CHANGE notification root
 * @param {object} context
 * @param {string} context.marketplaceKey
 * @param {string} context.stockLocationId
 */
export function mapAmazonOrderToNormalizedMarketplaceOrder(orderPayload, context) {
    const fromGetOrder = extractAmazonOrderRecord(orderPayload);
    const fromNotification = extractAmazonOrderChangeSummary(orderPayload);
    const amazonOrderId = fromGetOrder?.AmazonOrderId ?? fromNotification?.amazonOrderId;
    if (amazonOrderId === undefined || amazonOrderId.trim().length === 0) {
        throw new MarketplaceValidationError('Amazon order is missing AmazonOrderId');
    }
    const currency = parseCurrency(
        fromGetOrder?.OrderTotal?.CurrencyCode
        ?? fromNotification?.currencyCode
        ?? 'USD',
    );
    const lineItems = fromNotification?.orderItems ?? extractAmazonOrderItemsFromGetOrder(orderPayload);
    if (lineItems.length === 0) {
        throw new MarketplaceValidationError('Amazon order has no mappable line items');
    }
    const lines = lineItems.map((item) => {
        const sellerSku = typeof item.SellerSKU === 'string' ? item.SellerSKU.trim() : '';
        const orderItemId = typeof item.OrderItemId === 'string' ? item.OrderItemId.trim() : '';
        const quantity = Number(item.Quantity ?? item.QuantityOrdered ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new MarketplaceValidationError('Amazon order line quantity is invalid');
        }
        if (sellerSku.length === 0) {
            throw new MarketplaceValidationError('Amazon order line is missing SellerSKU');
        }
        return {
            quantity,
            stockLocationId: context.stockLocationId,
            merchantSku: sellerSku,
            ...(orderItemId.length > 0 ? { externalLineId: orderItemId } : {}),
        };
    });
    return {
        externalOrderId: amazonOrderId.trim(),
        marketplaceKey: context.marketplaceKey,
        status: 'pending',
        currency,
        lines,
    };
}

/**
 * @param {unknown} payload
 */
function extractAmazonOrderRecord(payload) {
    if (payload === null || typeof payload !== 'object') {
        return null;
    }
    const record = /** @type {Record<string, unknown>} */ (payload);
    const order = record.payload?.Order ?? record.Order ?? record.payload?.payload?.Order;
    if (order === null || typeof order !== 'object') {
        return null;
    }
    return /** @type {Record<string, unknown>} */ (order);
}

/**
 * @param {unknown} payload
 */
function extractAmazonOrderChangeSummary(payload) {
    if (payload === null || typeof payload !== 'object') {
        return null;
    }
    const root = /** @type {Record<string, unknown>} */ (payload);
    const notification = root.notification ?? root;
    if (notification === null || typeof notification !== 'object') {
        return null;
    }
    const change = /** @type {Record<string, unknown>} */ (notification).Payload?.OrderChangeNotification
        ?? /** @type {Record<string, unknown>} */ (notification).OrderChangeNotification;
    if (change === null || typeof change !== 'object') {
        return null;
    }
    const summary = /** @type {Record<string, unknown>} */ (change).Summary;
    if (summary === null || typeof summary !== 'object') {
        return null;
    }
    const amazonOrderId = typeof change.AmazonOrderId === 'string' ? change.AmazonOrderId : '';
    const orderItems = Array.isArray(summary.OrderItems) ? summary.OrderItems : [];
    return {
        amazonOrderId,
        orderItems,
        currencyCode: typeof summary.OrderTotal?.CurrencyCode === 'string'
            ? summary.OrderTotal.CurrencyCode
            : undefined,
    };
}

/**
 * @param {unknown} payload
 */
function extractAmazonOrderItemsFromGetOrder(payload) {
    const items = payload?.payload?.OrderItems
        ?? payload?.OrderItems
        ?? payload?.payload?.payload?.OrderItems;
    return Array.isArray(items) ? items : [];
}
