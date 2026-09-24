import { AppError } from '../../../shared/errors/index.js';
import { ErrorCode } from '../../../shared/errors/error-codes.js';

/** Retryable catalog sync failure (rate limit, transient adapter errors). */
export class CatalogSyncRetryError extends Error {
    /** @type {number | null} */
    retryDelayMs;

    /**
     * @param {string} [message]
     * @param {{ retryDelayMs?: number | null }} [options]
     */
    constructor(message = 'Catalog sync should be retried', options = {}) {
        super(message);
        this.name = 'CatalogSyncRetryError';
        this.retryDelayMs = options.retryDelayMs ?? null;
    }
}

/** Permanent failure — job must not retry. */
export class CatalogSyncPermanentError extends AppError {
    constructor(message, safeDetails) {
        super({
            code: ErrorCode.BUSINESS_RULE_VIOLATION,
            message,
            httpStatus: 422,
            safeDetails,
        });
        this.name = 'CatalogSyncPermanentError';
    }
}

export class UnsupportedMarketplaceAdapterError extends CatalogSyncPermanentError {
    constructor(marketplaceKey) {
        super('No marketplace catalog adapter is registered for this marketplace', {
            marketplaceKey,
        });
        this.name = 'UnsupportedMarketplaceAdapterError';
    }
}

/** Stale or irrelevant job — treated as successful skip. */
export class CatalogSyncSkippedError extends AppError {
    constructor(message, safeDetails) {
        super({
            code: ErrorCode.BUSINESS_RULE_VIOLATION,
            message,
            httpStatus: 200,
            safeDetails,
        });
        this.name = 'CatalogSyncSkippedError';
    }
}
