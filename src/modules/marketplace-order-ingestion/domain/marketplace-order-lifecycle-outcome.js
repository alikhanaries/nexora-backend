/** Result classification for lifecycle apply (low-cardinality metrics/logging). */
export const MarketplaceOrderLifecycleOutcome = Object.freeze({
    APPLIED: 'applied',
    DUPLICATE: 'duplicate',
    NOOP: 'noop',
    UNSUPPORTED: 'unsupported',
});

/** @typedef {typeof MarketplaceOrderLifecycleOutcome[keyof typeof MarketplaceOrderLifecycleOutcome]} MarketplaceOrderLifecycleOutcomeType */
