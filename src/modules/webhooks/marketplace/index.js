import { ReceiveMarketplaceWebhook } from './services/receive-marketplace-webhook.js';
import { ResolveMarketplaceWebhookConnection } from './services/resolve-marketplace-webhook-connection.js';
import { MarketplaceWebhookAdapterRegistry } from './public/marketplace-webhook-adapter-registry.js';

/**
 * @param {object} deps
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('../../orders/marketplace-ingestion/services/ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
 * @param {import('../../orders/marketplace-ingestion/services/marketplace-order-lifecycle-service.js').MarketplaceOrderLifecycleService} [deps.marketplaceOrderLifecycleService]
 * @param {import('../../orders/marketplace-ingestion/services/process-marketplace-lifecycle-payload.js').ProcessMarketplaceLifecyclePayload} [deps.processMarketplaceLifecyclePayload]
 * @param {import('../../orders/marketplace-ingestion/services/marketplace-lifecycle-enqueue-service.js').MarketplaceLifecycleEnqueueService} deps.lifecycleEnqueueService
 * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
 * @param {import('../../products/public/index.js').DefaultProductQueryService} [deps.productQueryService]
 * @param {(registry: MarketplaceWebhookAdapterRegistry) => void} [deps.registerMarketplaceWebhookAdapters]
 */
export function createMarketplaceWebhookIngestionModule(deps) {
    const webhookAdapterRegistry = new MarketplaceWebhookAdapterRegistry();
    deps.registerMarketplaceWebhookAdapters?.(webhookAdapterRegistry);
    const resolveConnection = new ResolveMarketplaceWebhookConnection(deps.database);
    const receiveMarketplaceWebhook = new ReceiveMarketplaceWebhook({
        resolveConnection: resolveConnection,
        webhookAdapterRegistry,
        lifecycleEnqueueService: deps.lifecycleEnqueueService,
        idempotency: deps.idempotency,
        metrics: deps.metrics,
        logger: deps.logger,
        ...(deps.productQueryService === undefined ? {} : { productQueryService: deps.productQueryService })
    });
    return {
        receiveMarketplaceWebhook,
        webhookAdapterRegistry
    };
}

export { MarketplaceWebhookAdapterRegistry } from './public/marketplace-webhook-adapter-registry.js';
export { normalizedMarketplaceWebhookEventSchema } from './services/normalized-marketplace-webhook-event.schema.js';
