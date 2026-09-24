import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import {
    MarketplaceAuthenticationError,
    MarketplaceConfigurationError,
    MarketplaceConflictError,
    MarketplaceNotFoundError,
    MarketplaceRateLimitError,
    MarketplaceTransientError,
    MarketplaceUnsupportedError,
    MarketplaceValidationError,
} from '../domain/marketplace-errors.js';

/**
 * @param {unknown} error
 */
export function mapMarketplaceErrorToAdapterError(error) {
    if (error instanceof MarketplaceRateLimitError) {
        const retryDelayMs = error.retryAfterSeconds !== null
            ? error.retryAfterSeconds * 1_000
            : 5_000;
        return new MarketplaceCatalogAdapterRetryError(error.message, { retryDelayMs });
    }
    if (error instanceof MarketplaceTransientError) {
        return new MarketplaceCatalogAdapterRetryError(error.message, {
            retryDelayMs: error.retryDelayMs ?? 5_000,
        });
    }
    if (error instanceof MarketplaceAuthenticationError ||
        error instanceof MarketplaceValidationError ||
        error instanceof MarketplaceConflictError ||
        error instanceof MarketplaceNotFoundError ||
        error instanceof MarketplaceUnsupportedError ||
        error instanceof MarketplaceConfigurationError) {
        return new MarketplaceCatalogAdapterPermanentError(error.message, {});
    }
    if (error instanceof MarketplaceCatalogAdapterRetryError ||
        error instanceof MarketplaceCatalogAdapterPermanentError) {
        return error;
    }
    throw error;
}
