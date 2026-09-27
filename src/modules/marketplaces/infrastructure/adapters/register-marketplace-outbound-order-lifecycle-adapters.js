import { ShopifyOrderLifecycleAdapter } from './shopify/shopify-order-lifecycle-adapter.js';

/**
 * @param {import('../../application/marketplace-outbound-order-lifecycle-adapter-registry.js').MarketplaceOutboundOrderLifecycleAdapterRegistry} registry
 * @param {{ shopifyAdminApiVersion?: string | null }} [deps]
 */
export function registerMarketplaceOutboundOrderLifecycleAdapters(registry, deps = {}) {
    registry.register(new ShopifyOrderLifecycleAdapter({
        deploymentDefaultApiVersion: deps.shopifyAdminApiVersion,
    }));
}
