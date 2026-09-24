/** Retryable failure surfaced by a marketplace catalog adapter. */
export class MarketplaceCatalogAdapterRetryError extends Error {
    /** @type {number | null} */
    retryDelayMs;

    /**
     * @param {string} [message]
     * @param {{ retryDelayMs?: number | null }} [options]
     */
    constructor(message = 'Marketplace catalog sync should be retried', options = {}) {
        super(message);
        this.name = 'MarketplaceCatalogAdapterRetryError';
        this.retryDelayMs = options.retryDelayMs ?? null;
    }
}

/** Permanent adapter failure — must not retry. */
export class MarketplaceCatalogAdapterPermanentError extends Error {
    /** @type {Record<string, unknown> | undefined} */
    safeDetails;

    /**
     * @param {string} message
     * @param {Record<string, unknown>} [safeDetails]
     */
    constructor(message, safeDetails) {
        super(message);
        this.name = 'MarketplaceCatalogAdapterPermanentError';
        this.safeDetails = safeDetails;
    }
}
