/** Retryable lifecycle failure (provider/network/infrastructure). */
export class MarketplaceOrderLifecycleRetryError extends Error {
    /** @type {number | null} */
    retryDelayMs;

    /**
     * @param {string} [message]
     * @param {{ retryDelayMs?: number | null }} [options]
     */
    constructor(message = 'Marketplace order lifecycle should be retried', options = {}) {
        super(message);
        this.name = 'MarketplaceOrderLifecycleRetryError';
        this.retryDelayMs = options.retryDelayMs ?? null;
    }
}

/** Permanent lifecycle failure — must not retry. */
export class MarketplaceOrderLifecyclePermanentError extends Error {
    /** @type {Record<string, unknown> | undefined} */
    safeDetails;

    /**
     * @param {string} message
     * @param {Record<string, unknown>} [safeDetails]
     */
    constructor(message, safeDetails) {
        super(message);
        this.name = 'MarketplaceOrderLifecyclePermanentError';
        this.safeDetails = safeDetails;
    }
}

/** Provider or connection does not support the requested lifecycle operation. */
export class MarketplaceOrderLifecycleUnsupportedError extends MarketplaceOrderLifecyclePermanentError {
    /**
     * @param {string} operation
     * @param {string} marketplaceKey
     */
    constructor(operation, marketplaceKey) {
        super('Marketplace order lifecycle operation is not supported', {
            operation,
            marketplaceKey,
        });
        this.name = 'MarketplaceOrderLifecycleUnsupportedError';
    }
}
