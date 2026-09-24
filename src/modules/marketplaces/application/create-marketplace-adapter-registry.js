import { MarketplaceCatalogAdapterRegistry } from '../../channel-catalog-sync/public/marketplace-catalog-adapter-registry.js';
import { registerMarketplaceCatalogAdapters } from '../infrastructure/adapters/register-marketplace-catalog-adapters.js';

/**
 * Production adapter registry for API connection tests and worker catalog sync.
 */
export function createMarketplaceAdapterRegistry() {
    const registry = new MarketplaceCatalogAdapterRegistry();
    registerMarketplaceCatalogAdapters(registry);
    return registry;
}
