import { AmazonCatalogAdapter } from './amazon/amazon-catalog-adapter.js';
import { NamshiCatalogAdapter } from './namshi/namshi-catalog-adapter.js';
import { NoonCatalogAdapter } from './noon/noon-catalog-adapter.js';
import { ShopifyCatalogAdapter } from './shopify/shopify-catalog-adapter.js';

/**
 * @param {import('../../../integration-catalog-sync/public/marketplace-catalog-adapter-registry.js').MarketplaceCatalogAdapterRegistry} registry
 * @param {{ httpClient?: import('../http/marketplace-http-client.js').MarketplaceHttpClient, amazonLwaTokenUrl?: string | null, noonApiBaseUrl?: string | null, noonUserAgent?: string | null, noonCatalogWritesEnabled?: boolean, noonTestLaneBlockHttp?: boolean, logger?: import('../../../../shared/logging/logger.port.js').Logger }} [deps]
 */
export function registerMarketplaceCatalogAdapters(registry, deps = {}) {
    const http = deps.httpClient;
    registry.register(new ShopifyCatalogAdapter({ http }));
    registry.register(new AmazonCatalogAdapter({
        deploymentLwaTokenUrl: deps.amazonLwaTokenUrl,
    }));
    registry.register(new NoonCatalogAdapter({
        deploymentApiBaseUrl: deps.noonApiBaseUrl,
        deploymentUserAgent: deps.noonUserAgent,
        catalogWritesEnabled: deps.noonCatalogWritesEnabled ?? false,
        testLaneBlockExternalHttp: deps.noonTestLaneBlockHttp ?? false,
        ...(deps.logger === undefined ? {} : { logger: deps.logger }),
    }));
    registry.register(new NamshiCatalogAdapter());
}
