/** Provider-neutral marketplace order lifecycle (adapter output). */
export const NormalizedMarketplaceOrderStatus = Object.freeze({
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    FULFILLED: 'fulfilled',
    UNKNOWN: 'unknown',
});

/** Statuses that Phase 28 ingestion accepts for initial Nexora order creation. */
export const INGESTIBLE_MARKETPLACE_ORDER_STATUSES = new Set([
    NormalizedMarketplaceOrderStatus.PENDING,
    NormalizedMarketplaceOrderStatus.CONFIRMED,
    NormalizedMarketplaceOrderStatus.UNKNOWN,
]);
