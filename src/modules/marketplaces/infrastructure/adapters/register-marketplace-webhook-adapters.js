import { AmazonWebhookAdapter } from './amazon/amazon-webhook-adapter.js';
import { NoonWebhookAdapter } from './noon/noon-webhook-adapter.js';

/**
 * @param {import('../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter-registry.js').MarketplaceWebhookAdapterRegistry} registry
 */
export function registerMarketplaceWebhookAdapters(registry) {
    registry.register(new AmazonWebhookAdapter());
    registry.register(new NoonWebhookAdapter());
}
