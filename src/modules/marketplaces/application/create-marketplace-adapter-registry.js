import { MarketplaceCatalogAdapterRegistry } from '../../channel-catalog-sync/public/marketplace-catalog-adapter-registry.js';
import { registerMarketplaceCatalogAdapters } from '../infrastructure/adapters/register-marketplace-catalog-adapters.js';

/**
 * @param {{ amazonLwaTokenUrl?: string | null, noonApiBaseUrl?: string | null, noonUserAgent?: string | null }} [deps]
 */
export function createMarketplaceAdapterRegistry(deps = {}) {
    const registry = new MarketplaceCatalogAdapterRegistry();
    registerMarketplaceCatalogAdapters(registry, deps);
    return registry;
}
