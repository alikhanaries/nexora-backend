/**
 * Webhooks umbrella: delegates merchant outbound subscriptions to `./outbound`,
 * re-exports marketplace ingestion and async dispatch/delivery factories for workers.
 */
import {
  createWebhooksModule as createOutboundWebhooksModule,
  createWebhookDispatchService,
  createWebhookDeliveryService,
} from './outbound/index.js';
import { createMarketplaceWebhookIngestionModule } from './marketplace/index.js';

/**
 * @param {object} deps — forwarded to `createWebhooksModule` in `./outbound`
 * @returns {ReturnType<typeof createOutboundWebhooksModule>}
 */
export function createWebhooksModule(deps) {
  return createOutboundWebhooksModule(deps);
}

export {
  createWebhookDispatchService,
  createWebhookDeliveryService,
  createMarketplaceWebhookIngestionModule,
};

export { MarketplaceWebhookAdapterRegistry } from './marketplace/public/marketplace-webhook-adapter-registry.js';
export { normalizedMarketplaceWebhookEventSchema } from './marketplace/services/normalized-marketplace-webhook-event.schema.js';
