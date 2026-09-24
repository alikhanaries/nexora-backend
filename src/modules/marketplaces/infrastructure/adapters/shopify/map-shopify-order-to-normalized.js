import { ValidationError } from '../../../../../shared/errors/index.js';
import { getCurrencyMinorUnitExponent, parseCurrency } from '../../../../../shared/money/index.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { ShopifyExternalEntityType } from './shopify-external-entity-types.js';
import { shopifyOrderGidToExternalId } from './shopify-order-gid.js';
import { mapShopifyOrderStatus } from './shopify-order-status.js';

/**
 * @param {string} currency
 * @param {string|number} decimal
 */
function decimalToMinorUnits(currency, decimal) {
    const normalizedCurrency = parseCurrency(currency);
    const amount = typeof decimal === 'number' ? decimal : Number.parseFloat(String(decimal));
    if (!Number.isFinite(amount) || amount < 0) {
        throw new ValidationError('Amount must be a non-negative number');
    }
    const exponent = getCurrencyMinorUnitExponent(normalizedCurrency);
    const minor = Math.round(amount * (10 ** exponent));
    if (!Number.isSafeInteger(minor)) {
        throw new ValidationError('Amount exceeds safe integer range');
    }
    return minor;
}

/**
 * @param {unknown} address
 */
function mapShopifyAddress(address) {
    if (address === null || address === undefined || typeof address !== 'object') {
        return null;
    }
    const record = /** @type {Record<string, unknown>} */ (address);
    return {
        line1: stringOrNull(record.address1),
        line2: stringOrNull(record.address2),
        city: stringOrNull(record.city),
        region: stringOrNull(record.provinceCode),
        postalCode: stringOrNull(record.zip),
        countryCode: stringOrNull(record.countryCodeV2),
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
 * @param {unknown} moneySet
 * @param {string} currencyCode
 */
function moneySetToMinor(moneySet, currencyCode) {
    if (moneySet === null || moneySet === undefined || typeof moneySet !== 'object') {
        return 0;
    }
    const shopMoney = /** @type {Record<string, unknown>} */ (moneySet).shopMoney;
    if (shopMoney === null || typeof shopMoney !== 'object') {
        return 0;
    }
    const amount = /** @type {Record<string, unknown>} */ (shopMoney).amount;
    const currency = stringOrNull(/** @type {Record<string, unknown>} */ (shopMoney).currencyCode) ?? currencyCode;
    return decimalToMinorUnits(currency, amount ?? 0);
}

/**
 * @param {unknown} shopifyOrder
 * @param {object} context
 * @param {string} context.marketplaceKey
 * @param {string} context.stockLocationId
 */
export function mapShopifyOrderToNormalized(shopifyOrder, context) {
    if (shopifyOrder === null || typeof shopifyOrder !== 'object') {
        throw new MarketplaceValidationError('Shopify order payload is invalid');
    }
    const order = /** @type {Record<string, unknown>} */ (shopifyOrder);
    const id = stringOrNull(order.id);
    if (id === null) {
        throw new MarketplaceValidationError('Shopify order id is required');
    }
    const currencyCode = parseCurrency(String(order.currencyCode ?? 'USD'));
    const status = mapShopifyOrderStatus({
        cancelledAt: order.cancelledAt,
        displayFinancialStatus: order.displayFinancialStatus,
        displayFulfillmentStatus: order.displayFulfillmentStatus,
    });
    const lineItems = mapShopifyLineItems(order.lineItems, context.stockLocationId, currencyCode);
    const customer = mapShopifyCustomer(order.customer, order);
    return {
        externalOrderId: shopifyOrderGidToExternalId(id),
        externalOrderNumber: stringOrNull(order.name) ?? undefined,
        marketplaceKey: context.marketplaceKey,
        status,
        currency: currencyCode,
        subtotalMinor: moneySetToMinor(order.currentSubtotalPriceSet, currencyCode),
        discountMinor: moneySetToMinor(order.currentTotalDiscountsSet, currencyCode),
        taxMinor: moneySetToMinor(order.currentTotalTaxSet, currencyCode),
        shippingMinor: moneySetToMinor(order.totalShippingPriceSet, currencyCode),
        totalMinor: moneySetToMinor(order.currentTotalPriceSet, currencyCode),
        ...(customer === undefined ? {} : { customer }),
        lines: lineItems,
    };
}

/**
 * @param {unknown} lineItemsConnection
 * @param {string} stockLocationId
 * @param {string} currencyCode
 */
function mapShopifyLineItems(lineItemsConnection, stockLocationId, currencyCode) {
    if (lineItemsConnection === null || typeof lineItemsConnection !== 'object') {
        throw new MarketplaceValidationError('Shopify order has no line items');
    }
    const edges = /** @type {Record<string, unknown>} */ (lineItemsConnection).edges;
    if (!Array.isArray(edges) || edges.length === 0) {
        throw new MarketplaceValidationError('Shopify order must contain at least one line item');
    }
    /** @type {import('../../../../marketplace-order-ingestion/application/normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder['lines']} */
    const lines = [];
    for (const edge of edges) {
        if (edge === null || typeof edge !== 'object') {
            continue;
        }
        const node = /** @type {Record<string, unknown>} */ (edge).node;
        if (node === null || typeof node !== 'object') {
            continue;
        }
        const line = /** @type {Record<string, unknown>} */ (node);
        const quantity = Number(line.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new MarketplaceValidationError('Shopify line item quantity is invalid');
        }
        const variant = line.variant !== null && typeof line.variant === 'object'
            ? /** @type {Record<string, unknown>} */ (line.variant)
            : null;
        const sku = stringOrNull(line.sku) ?? (variant === null ? null : stringOrNull(variant.sku));
        const variantId = variant === null ? null : stringOrNull(variant.id);
        const externalLineId = stringOrNull(line.id);
        const unitPriceMinor = moneySetToMinor(line.originalUnitPriceSet, currencyCode);
        const base = {
            quantity,
            stockLocationId,
            unitPriceMinor,
            lineTotalMinor: unitPriceMinor * quantity,
            ...(externalLineId === null ? {} : { externalLineId }),
        };
        if (sku !== null) {
            lines.push({ ...base, merchantSku: sku });
            continue;
        }
        if (variantId !== null) {
            lines.push({
                ...base,
                marketplaceExternalEntity: {
                    externalEntityType: ShopifyExternalEntityType.PRODUCT_VARIANT,
                    externalEntityId: variantId,
                },
            });
            continue;
        }
        throw new MarketplaceValidationError('Shopify line item has no SKU or variant mapping');
    }
    if (lines.length === 0) {
        throw new MarketplaceValidationError('Shopify order must contain at least one line item');
    }
    return lines;
}

/**
 * @param {unknown} customerNode
 * @param {Record<string, unknown>} order
 */
function mapShopifyCustomer(customerNode, order) {
    const shippingAddress = mapShopifyAddress(order.shippingAddress);
    const billingAddress = mapShopifyAddress(order.billingAddress);
    if (customerNode === null || typeof customerNode !== 'object') {
        if (shippingAddress === null && billingAddress === null) {
            return undefined;
        }
        return {
            shippingAddress,
            billingAddress,
        };
    }
    const customer = /** @type {Record<string, unknown>} */ (customerNode);
    return {
        externalCustomerReference: stringOrNull(customer.id),
        firstName: stringOrNull(customer.firstName),
        lastName: stringOrNull(customer.lastName),
        email: stringOrNull(customer.email),
        phone: stringOrNull(customer.phone),
        shippingAddress,
        billingAddress,
    };
}
