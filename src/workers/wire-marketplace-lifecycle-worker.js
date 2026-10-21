import { MarketplaceOrderLifecycleProcessor } from '../modules/webhooks/marketplace/services/marketplace-order-lifecycle-processor.js';
import { createMarketplaceLifecycleEnqueueService } from '../modules/orders/marketplace-ingestion/services/marketplace-lifecycle-enqueue-service.js';
import { createExecuteMarketplaceLifecycleJob } from '../modules/orders/marketplace-ingestion/services/execute-marketplace-lifecycle-job.js';
import { createFetchAndEnqueueMarketplaceOrderLifecycle } from '../modules/orders/marketplace-ingestion/services/fetch-and-enqueue-marketplace-order-lifecycle.js';
import { EnqueueOutboundMarketplaceOrderLifecycleCommand } from '../modules/marketplaces/services/enqueue-outbound-marketplace-order-lifecycle-command.js';

/**
 * @param {object} deps
 * @param {import('../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../shared/queue/job-queue.port.js').JobQueue} deps.queue
 * @param {import('../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../app/config/config.js').loadConfig extends (...args: never) => infer R ? R : never} deps.config
 * @param {import('../modules/orders/marketplace-ingestion/services/ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
 * @param {import('../modules/orders/marketplace-ingestion/services/marketplace-order-lifecycle-service.js').MarketplaceOrderLifecycleService} deps.lifecycleService
 * @param {import('../modules/orders/marketplace-ingestion/services/process-marketplace-lifecycle-payload.js').ProcessMarketplaceLifecyclePayload} [deps.processMarketplaceLifecyclePayload]
 * @param {import('../modules/marketplaces/services/execute-outbound-marketplace-order-lifecycle-command.js').ExecuteOutboundMarketplaceOrderLifecycleCommand} [deps.executeOutboundMarketplaceOrderLifecycle]
 * @param {import('../modules/orders/marketplace-ingestion/public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
 * @param {import('../modules/integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
 * @param {import('../modules/commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../modules/orders/marketplace-ingestion/public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
 */
export function wireMarketplaceLifecycleWorker(deps) {
    const lifecycleEnqueueService = createMarketplaceLifecycleEnqueueService({
        queue: deps.queue,
        metrics: deps.metrics,
        lifecycleConfig: deps.config.marketplaceLifecycle,
    });
    const orderLifecycleProcessor = new MarketplaceOrderLifecycleProcessor({
        ingestNormalizedMarketplaceOrder: deps.ingestNormalizedMarketplaceOrder,
        marketplaceOrderLifecycleService: deps.lifecycleService,
        ...(deps.processMarketplaceLifecyclePayload === undefined
            ? {}
            : { processMarketplaceLifecyclePayload: deps.processMarketplaceLifecyclePayload }),
    });
    const executeMarketplaceLifecycleJob = createExecuteMarketplaceLifecycleJob({
        orderLifecycleProcessor,
        lifecycleService: deps.lifecycleService,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        metrics: deps.metrics,
        logger: deps.logger,
        ...(deps.executeOutboundMarketplaceOrderLifecycle === undefined
            ? {}
            : { executeOutboundLifecycle: deps.executeOutboundMarketplaceOrderLifecycle }),
    });
    const fetchAndEnqueueMarketplaceOrderLifecycle = createFetchAndEnqueueMarketplaceOrderLifecycle({
        lifecycleEnqueueService,
        orderAdapterRegistry: deps.orderAdapterRegistry,
        marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        database: deps.database,
    });
    const enqueueOutboundMarketplaceOrderLifecycle = new EnqueueOutboundMarketplaceOrderLifecycleCommand({
        lifecycleEnqueueService,
    });
    return {
        lifecycleEnqueueService,
        executeMarketplaceLifecycleJob,
        fetchAndEnqueueMarketplaceOrderLifecycle,
        enqueueOutboundMarketplaceOrderLifecycle,
    };
}
