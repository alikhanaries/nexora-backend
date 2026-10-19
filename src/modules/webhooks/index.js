import {
  createWebhooksModule as createOutboundWebhooksModule,
  createWebhookDispatchService,
  createWebhookDeliveryService,
} from './outbound/index.js';
import { createMarketplaceWebhookIngestionModule } from './marketplace/index.js';

/** Outbound merchant webhook subscriptions + delivery. */
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
