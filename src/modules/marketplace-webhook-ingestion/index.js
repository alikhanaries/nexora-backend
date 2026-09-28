import { ReceiveMarketplaceWebhook } from './application/receive-marketplace-webhook.js';
import { ResolveMarketplaceWebhookConnection } from './application/resolve-marketplace-webhook-connection.js';
import { MarketplaceWebhookAdapterRegistry } from './public/marketplace-webhook-adapter-registry.js';
import { createMarketplaceWebhookRoutes } from './presentation/marketplace-webhook.routes.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('../marketplace-order-ingestion/application/ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
 * @param {import('../marketplace-order-ingestion/application/marketplace-order-lifecycle-service.js').MarketplaceOrderLifecycleService} [deps.marketplaceOrderLifecycleService]
 * @param {import('../marketplace-order-ingestion/application/process-marketplace-lifecycle-payload.js').ProcessMarketplaceLifecyclePayload} [deps.processMarketplaceLifecyclePayload]
 * @param {import('../marketplace-order-ingestion/application/marketplace-lifecycle-enqueue-service.js').MarketplaceLifecycleEnqueueService} deps.lifecycleEnqueueService
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../shared/logging/logger.port.js').Logger} [deps.logger]
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
    });
    const routes = createMarketplaceWebhookRoutes({ receiveMarketplaceWebhook });
    return {
        receiveMarketplaceWebhook,
        webhookAdapterRegistry,
        routes,
    };
}

export { MarketplaceWebhookAdapterRegistry } from './public/marketplace-webhook-adapter-registry.js';
export { normalizedMarketplaceWebhookEventSchema } from './application/normalized-marketplace-webhook-event.schema.js';
