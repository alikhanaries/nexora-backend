import { AmazonOutboundOrderLifecycleAdapter } from './amazon/amazon-outbound-order-lifecycle-adapter.js';
import { NamshiOutboundOrderLifecycleAdapter } from './namshi/namshi-outbound-order-lifecycle-adapter.js';
import { NoonOutboundOrderLifecycleAdapter } from './noon/noon-outbound-order-lifecycle-adapter.js';
import { ShopifyOrderLifecycleAdapter } from './shopify/shopify-order-lifecycle-adapter.js';

/**
 * @param {import('../../application/marketplace-outbound-order-lifecycle-adapter-registry.js').MarketplaceOutboundOrderLifecycleAdapterRegistry} registry
 * @param {{ shopifyAdminApiVersion?: string | null, amazonLwaTokenUrl?: string | null, noonApiBaseUrl?: string | null, noonUserAgent?: string | null }} [deps]
 */
export function registerMarketplaceOutboundOrderLifecycleAdapters(registry, deps = {}) {
    registry.register(new ShopifyOrderLifecycleAdapter({
        deploymentDefaultApiVersion: deps.shopifyAdminApiVersion,
    }));
    registry.register(new AmazonOutboundOrderLifecycleAdapter({
        deploymentLwaTokenUrl: deps.amazonLwaTokenUrl,
    }));
    registry.register(new NoonOutboundOrderLifecycleAdapter({
        deploymentApiBaseUrl: deps.noonApiBaseUrl,
        deploymentUserAgent: deps.noonUserAgent,
    }));
    registry.register(new NamshiOutboundOrderLifecycleAdapter({
        deploymentApiBaseUrl: deps.noonApiBaseUrl,
        deploymentUserAgent: deps.noonUserAgent,
    }));
}
