import { createMarketplaceWebhookIngestionModule } from '../../modules/marketplace-webhook-ingestion/index.js';
import { MarketplaceLifecycleEnqueueService } from '../../modules/marketplace-order-ingestion/application/marketplace-lifecycle-enqueue-service.js';
import { MarketplaceAdapterRuntimeFactory } from '../../modules/marketplaces/application/marketplace-adapter-runtime-factory.js';
import { registerMarketplaceWebhookAdapters } from '../../modules/marketplaces/infrastructure/adapters/register-marketplace-webhook-adapters.js';
import { PostgresMarketplaceConnectionRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { ShopifyOrderAdapter } from '../../modules/marketplaces/infrastructure/adapters/shopify/shopify-order-adapter.js';

/**
 * Same wiring as {@link createApplication} marketplace webhook ingestion (HTTP enqueue path only).
 */
export function wireMarketplaceWebhookIngestion(input) {
  const marketplaceAdapterRuntimeFactory = new MarketplaceAdapterRuntimeFactory({
    connections: new PostgresMarketplaceConnectionRepository(),
    secretEncryptor: input.identity.auth.secretEncryptor,
    queryable: input.database,
    shopifyAdminApiVersion: input.config.marketplace.shopifyAdminApiVersion,
  });
  const shopifyOrderAdapter = new ShopifyOrderAdapter({
    deploymentDefaultApiVersion: input.config.marketplace.shopifyAdminApiVersion,
  });
  const lifecycleEnqueueService = new MarketplaceLifecycleEnqueueService({
    queue: input.queue,
    metrics: input.metrics,
    lifecycleConfig: input.config.marketplaceLifecycle,
  });

  return createMarketplaceWebhookIngestionModule({
    database: input.database,
    idempotency: input.idempotency,
    metrics: input.metrics,
    logger: input.logger,
    productQueryService: input.products.productQueryService,
    lifecycleEnqueueService,
    registerMarketplaceWebhookAdapters: (registry) =>
      registerMarketplaceWebhookAdapters(registry, {
        marketplaceAdapterRuntimeFactory,
        channelQueryService: input.channels.channelQueryService,
        database: input.database,
        shopifyOrderAdapter,
      }),
  });
}
