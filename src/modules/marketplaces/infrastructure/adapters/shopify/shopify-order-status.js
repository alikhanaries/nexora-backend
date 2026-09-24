import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';

/** Normalized marketplace order status strings (mirrors marketplace-order-ingestion domain). */
const NormalizedStatus = Object.freeze({
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    FULFILLED: 'fulfilled',
    UNKNOWN: 'unknown',
});

/**
 * Maps Shopify Admin GraphQL order display fields to normalized status.
 *
 * @param {object} order
 * @param {string|null|undefined} order.cancelledAt
 * @param {string|null|undefined} order.displayFinancialStatus
 * @param {string|null|undefined} order.displayFulfillmentStatus
 */
export function mapShopifyOrderStatus(order) {
    if (order.cancelledAt !== null && order.cancelledAt !== undefined && String(order.cancelledAt).length > 0) {
        return NormalizedStatus.CANCELLED;
    }
    const fulfillment = String(order.displayFulfillmentStatus ?? '').toUpperCase();
    if (fulfillment === 'FULFILLED') {
        return NormalizedStatus.FULFILLED;
    }
    const financial = String(order.displayFinancialStatus ?? '').toUpperCase();
    if (financial === 'PAID' || financial === 'PARTIALLY_PAID' || financial === 'AUTHORIZED') {
        return NormalizedStatus.CONFIRMED;
    }
    if (financial === 'PENDING' || financial === 'PARTIALLY_REFUNDED') {
        return NormalizedStatus.PENDING;
    }
    if (financial === 'REFUNDED' || financial === 'VOIDED' || financial === 'EXPIRED') {
        throw new MarketplaceValidationError('Shopify order financial status is not eligible for ingestion', {
            displayFinancialStatus: financial,
        });
    }
    return NormalizedStatus.UNKNOWN;
}
