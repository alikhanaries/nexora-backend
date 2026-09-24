import { AmazonCatalogAdapter } from './amazon/amazon-catalog-adapter.js';
import { NamshiCatalogAdapter } from './namshi/namshi-catalog-adapter.js';
import { NoonCatalogAdapter } from './noon/noon-catalog-adapter.js';
import { ShopifyCatalogAdapter } from './shopify/shopify-catalog-adapter.js';

/**
 * @param {import('../../../channel-catalog-sync/public/marketplace-catalog-adapter-registry.js').MarketplaceCatalogAdapterRegistry} registry
 * @param {{ httpClient?: import('../http/marketplace-http-client.js').MarketplaceHttpClient }} [deps]
 */
export function registerMarketplaceCatalogAdapters(registry, deps = {}) {
    const http = deps.httpClient;
    registry.register(new ShopifyCatalogAdapter({ http }));
    registry.register(new AmazonCatalogAdapter({ http }));
    registry.register(new NoonCatalogAdapter());
    registry.register(new NamshiCatalogAdapter());
}
