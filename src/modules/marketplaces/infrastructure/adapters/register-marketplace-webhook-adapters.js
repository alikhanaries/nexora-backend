import { ShopifyMarketplaceWebhookAdapter } from './shopify/shopify-marketplace-webhook-adapter.js';

/**
 * @param {import('../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter-registry.js').MarketplaceWebhookAdapterRegistry} registry
 * @param {object} deps
 * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
 * @param {import('../../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('../../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('./shopify/shopify-order-adapter.js').ShopifyOrderAdapter} deps.shopifyOrderAdapter
 */
export function registerMarketplaceWebhookAdapters(registry, deps) {
    registry.register(new ShopifyMarketplaceWebhookAdapter(deps));
}
