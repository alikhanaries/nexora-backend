import { UnsupportedMarketplaceAdapterError } from '../application/catalog-sync-errors.js';

export class MarketplaceCatalogAdapterRegistry {
    /** @type {Map<string, import('../public/marketplace-catalog-adapter.port.js').MarketplaceCatalogAdapter>} */
    adapters = new Map();

    /**
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplaceCatalogAdapter} adapter
     */
    register(adapter) {
        this.adapters.set(adapter.marketplaceKey, adapter);
    }

    /**
     * @param {string} marketplaceKey
     */
    resolve(marketplaceKey) {
        const adapter = this.adapters.get(marketplaceKey);
        if (adapter === undefined) {
            throw new UnsupportedMarketplaceAdapterError(marketplaceKey);
        }
        return adapter;
    }
}
