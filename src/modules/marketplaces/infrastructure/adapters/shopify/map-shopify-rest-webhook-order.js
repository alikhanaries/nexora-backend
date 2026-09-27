import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { toShopifyOrderGid } from './shopify-order-gid.js';

/**
 * Maps Shopify REST webhook order payloads to Admin GraphQL order shape for {@link mapShopifyOrderToNormalized}.
 *
 * @param {unknown} restOrder
 */
export function mapShopifyRestWebhookOrderToGraphqlShape(restOrder) {
    if (restOrder === null || typeof restOrder !== 'object') {
        throw new MarketplaceValidationError('Shopify webhook order payload is invalid');
    }
    const order = /** @type {Record<string, unknown>} */ (restOrder);
    const adminGraphqlApiId = stringOrNull(order.admin_graphql_api_id);
    const legacyId = order.id;
    const id = adminGraphqlApiId ?? (legacyId === undefined || legacyId === null
        ? null
        : toShopifyOrderGid(String(legacyId)));
    if (id === null) {
        throw new MarketplaceValidationError('Shopify webhook order id is missing');
    }
    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
    return {
        id,
        name: order.name,
        cancelledAt: order.cancelled_at ?? null,
        displayFinancialStatus: mapFinancialStatus(order.financial_status),
        displayFulfillmentStatus: mapFulfillmentStatus(order.fulfillment_status),
        currencyCode: order.currency ?? order.presentment_currency ?? 'USD',
        currentSubtotalPriceSet: moneyFromDecimal(order.current_subtotal_price ?? order.subtotal_price, order.currency),
        currentTotalDiscountsSet: moneyFromDecimal(order.total_discounts, order.currency),
        currentTotalTaxSet: moneyFromDecimal(order.total_tax, order.currency),
        totalShippingPriceSet: moneyFromDecimal(order.total_shipping_price_set?.shop_money?.amount ?? order.total_shipping_price, order.currency),
        currentTotalPriceSet: moneyFromDecimal(order.current_total_price ?? order.total_price, order.currency),
        customer: order.customer,
        shippingAddress: mapRestAddress(order.shipping_address),
        billingAddress: mapRestAddress(order.billing_address),
        lineItems: {
            edges: lineItems.map((line) => ({
                node: mapRestLineItem(line),
            })),
        },
    };
}

/**
 * @param {unknown} value
 */
function stringOrNull(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
}

/**
 * @param {unknown} address
 */
function mapRestAddress(address) {
    if (address === null || typeof address !== 'object') {
        return null;
    }
    const record = /** @type {Record<string, unknown>} */ (address);
    return {
        address1: record.address1,
        address2: record.address2,
        city: record.city,
        provinceCode: record.province_code,
        zip: record.zip,
        countryCodeV2: record.country_code,
    };
}

/**
 * @param {unknown} line
 */
function mapRestLineItem(line) {
    if (line === null || typeof line !== 'object') {
        throw new MarketplaceValidationError('Shopify webhook line item is invalid');
    }
    const record = /** @type {Record<string, unknown>} */ (line);
    const variantId = record.variant_id;
    return {
        id: record.admin_graphql_api_id ?? (record.id === undefined ? null : `gid://shopify/LineItem/${record.id}`),
        sku: record.sku,
        quantity: record.quantity,
        variant: variantId === undefined || variantId === null
            ? null
            : {
                id: record.variant_admin_graphql_api_id ?? `gid://shopify/ProductVariant/${variantId}`,
                sku: record.sku,
            },
        originalUnitPriceSet: moneyFromDecimal(record.price, record.currency),
    };
}

/**
 * @param {unknown} amount
 * @param {unknown} currency
 */
function moneyFromDecimal(amount, currency) {
    const currencyCode = stringOrNull(currency) ?? 'USD';
    return { shopMoney: { amount: String(amount ?? '0'), currencyCode } };
}

/**
 * @param {unknown} financialStatus
 */
function mapFinancialStatus(financialStatus) {
    const value = stringOrNull(financialStatus);
    if (value === null) {
        return 'PENDING';
    }
    return value.toUpperCase().replace(/-/g, '_');
}

/**
 * @param {unknown} fulfillmentStatus
 */
function mapFulfillmentStatus(fulfillmentStatus) {
    if (fulfillmentStatus === null || fulfillmentStatus === undefined || String(fulfillmentStatus).trim().length === 0) {
        return 'UNFULFILLED';
    }
    return String(fulfillmentStatus).toUpperCase();
}
