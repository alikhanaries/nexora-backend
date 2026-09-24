/** Retryable marketplace order ingestion failure (provider/network). */
export class MarketplaceOrderIngestionRetryError extends Error {
    /** @type {number | null} */
    retryDelayMs;

    /**
     * @param {string} [message]
     * @param {{ retryDelayMs?: number | null }} [options]
     */
    constructor(message = 'Marketplace order ingestion should be retried', options = {}) {
        super(message);
        this.name = 'MarketplaceOrderIngestionRetryError';
        this.retryDelayMs = options.retryDelayMs ?? null;
    }
}

/** Permanent ingestion failure — must not retry. */
export class MarketplaceOrderIngestionPermanentError extends Error {
    /** @type {Record<string, unknown> | undefined} */
    safeDetails;

    /**
     * @param {string} message
     * @param {Record<string, unknown>} [safeDetails]
     */
    constructor(message, safeDetails) {
        super(message);
        this.name = 'MarketplaceOrderIngestionPermanentError';
        this.safeDetails = safeDetails;
    }
}
