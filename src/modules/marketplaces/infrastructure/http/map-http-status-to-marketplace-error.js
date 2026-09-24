import {
    MarketplaceAuthenticationError,
    MarketplaceConflictError,
    MarketplaceNotFoundError,
    MarketplaceRateLimitError,
    MarketplaceTransientError,
    MarketplaceValidationError,
} from '../../domain/marketplace-errors.js';

/**
 * @param {number} status
 * @param {{ retryAfterHeader?: string | null, body?: unknown }} [context]
 */
export function mapHttpStatusToMarketplaceError(status, context = {}) {
    if (status === 401 || status === 403) {
        return new MarketplaceAuthenticationError();
    }
    if (status === 404) {
        return new MarketplaceNotFoundError();
    }
    if (status === 409) {
        return new MarketplaceConflictError();
    }
    if (status === 429) {
        const retryAfterSeconds = parseRetryAfter(context.retryAfterHeader);
        return new MarketplaceRateLimitError(undefined, { retryAfterSeconds });
    }
    if (status === 400 || status === 422) {
        return new MarketplaceValidationError();
    }
    if (status >= 500) {
        return new MarketplaceTransientError(undefined, { retryDelayMs: 5_000 });
    }
    return new MarketplaceValidationError(`Unexpected marketplace HTTP status ${status}`);
}

/**
 * @param {string | null | undefined} header
 */
function parseRetryAfter(header) {
    if (header === null || header === undefined || header.trim().length === 0) {
        return null;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.ceil(seconds);
    }
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
        return Math.max(0, Math.ceil((dateMs - Date.now()) / 1_000));
    }
    return null;
}
