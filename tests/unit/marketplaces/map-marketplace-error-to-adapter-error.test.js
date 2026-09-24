import { describe, expect, it } from 'vitest';
import { mapMarketplaceErrorToAdapterError } from '../../../src/modules/marketplaces/application/map-marketplace-error-to-adapter-error.js';
import {
    MarketplaceAuthenticationError,
    MarketplaceRateLimitError,
    MarketplaceTransientError,
    MarketplaceUnsupportedError,
} from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

describe('mapMarketplaceErrorToAdapterError', () => {
    it('maps rate limits to retry errors with delay', () => {
        const mapped = mapMarketplaceErrorToAdapterError(new MarketplaceRateLimitError(undefined, {
            retryAfterSeconds: 12,
        }));
        expect(mapped).toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
        expect(mapped.retryDelayMs).toBe(12_000);
    });

    it('maps authentication failures to permanent errors', () => {
        const mapped = mapMarketplaceErrorToAdapterError(new MarketplaceAuthenticationError());
        expect(mapped).toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('maps unsupported operations to permanent errors', () => {
        const mapped = mapMarketplaceErrorToAdapterError(new MarketplaceUnsupportedError('nope'));
        expect(mapped).toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('maps transient errors to retry errors', () => {
        const mapped = mapMarketplaceErrorToAdapterError(new MarketplaceTransientError(undefined, {
            retryDelayMs: 2_000,
        }));
        expect(mapped).toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
        expect(mapped.retryDelayMs).toBe(2_000);
    });
});
