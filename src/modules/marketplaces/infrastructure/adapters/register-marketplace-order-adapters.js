import { AmazonOrderAdapter } from './amazon/amazon-order-adapter.js';
import { ShopifyOrderAdapter } from './shopify/shopify-order-adapter.js';

/**
 * @param {import('../../../marketplace-order-ingestion/public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} registry
 * @param {{ httpClient?: import('../http/marketplace-http-client.js').MarketplaceHttpClient, shopifyAdminApiVersion?: string | null, amazonLwaTokenUrl?: string | null }} [deps]
 */
export function registerMarketplaceOrderAdapters(registry, deps = {}) {
    registry.register(new ShopifyOrderAdapter({
        deploymentDefaultApiVersion: deps.shopifyAdminApiVersion,
    }));
    registry.register(new AmazonOrderAdapter({
        deploymentLwaTokenUrl: deps.amazonLwaTokenUrl,
    }));
}
