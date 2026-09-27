import { AmazonOutboundOrderLifecycleAdapter } from './amazon/amazon-outbound-order-lifecycle-adapter.js';
import { ShopifyOrderLifecycleAdapter } from './shopify/shopify-order-lifecycle-adapter.js';

/**
 * @param {import('../../application/marketplace-outbound-order-lifecycle-adapter-registry.js').MarketplaceOutboundOrderLifecycleAdapterRegistry} registry
 * @param {{ shopifyAdminApiVersion?: string | null, amazonLwaTokenUrl?: string | null }} [deps]
 */
export function registerMarketplaceOutboundOrderLifecycleAdapters(registry, deps = {}) {
    registry.register(new ShopifyOrderLifecycleAdapter({
        deploymentDefaultApiVersion: deps.shopifyAdminApiVersion,
    }));
    registry.register(new AmazonOutboundOrderLifecycleAdapter({
        deploymentLwaTokenUrl: deps.amazonLwaTokenUrl,
    }));
}
