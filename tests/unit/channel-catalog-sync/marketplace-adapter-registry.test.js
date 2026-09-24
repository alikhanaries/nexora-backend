import { describe, expect, it } from 'vitest';
import { UnsupportedMarketplaceAdapterError } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-errors.js';
import { MarketplaceCatalogAdapterRegistry } from '../../../src/modules/channel-catalog-sync/infrastructure/marketplace-catalog-adapter-registry.js';
import { FOUNDATION_STUB_MARKETPLACE_KEY } from '../../../src/modules/channel-catalog-sync/public/marketplace-catalog-adapter.port.js';
import { FoundationStubMarketplaceCatalogAdapter } from '../../../src/modules/channel-catalog-sync/infrastructure/foundation-stub-marketplace-catalog-adapter.js';

describe('MarketplaceCatalogAdapterRegistry', () => {
    it('resolves registered adapters by marketplace key', () => {
        const registry = new MarketplaceCatalogAdapterRegistry();
        registry.register(new FoundationStubMarketplaceCatalogAdapter());
        const adapter = registry.resolve(FOUNDATION_STUB_MARKETPLACE_KEY);
        expect(adapter.marketplaceKey).toBe(FOUNDATION_STUB_MARKETPLACE_KEY);
    });

    it('fails explicitly for unsupported marketplace keys', () => {
        const registry = new MarketplaceCatalogAdapterRegistry();
        expect(() => registry.resolve('unknown-marketplace')).toThrow(UnsupportedMarketplaceAdapterError);
    });
});
