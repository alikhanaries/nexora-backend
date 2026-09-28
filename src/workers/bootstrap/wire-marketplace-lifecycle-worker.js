import { MarketplaceOrderLifecycleProcessor } from '../../modules/marketplace-webhook-ingestion/application/marketplace-order-lifecycle-processor.js';
import { MarketplaceLifecycleEnqueueService } from '../../modules/marketplace-order-ingestion/application/marketplace-lifecycle-enqueue-service.js';
import { ExecuteMarketplaceLifecycleJob } from '../../modules/marketplace-order-ingestion/application/execute-marketplace-lifecycle-job.js';
import { FetchAndEnqueueMarketplaceOrderLifecycle } from '../../modules/marketplace-order-ingestion/application/fetch-and-enqueue-marketplace-order-lifecycle.js';
import { EnqueueOutboundMarketplaceOrderLifecycleCommand } from '../../modules/marketplaces/application/enqueue-outbound-marketplace-order-lifecycle-command.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/queue/job-queue.port.js').JobQueue} deps.queue
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../../app/config/config.js').loadConfig extends (...args: never) => infer R ? R : never} deps.config
 * @param {import('../../modules/marketplace-order-ingestion/application/ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
 * @param {import('../../modules/marketplace-order-ingestion/application/marketplace-order-lifecycle-service.js').MarketplaceOrderLifecycleService} deps.lifecycleService
 * @param {import('../../modules/marketplace-order-ingestion/application/process-marketplace-lifecycle-payload.js').ProcessMarketplaceLifecyclePayload} [deps.processMarketplaceLifecyclePayload]
 * @param {import('../../modules/marketplaces/application/execute-outbound-marketplace-order-lifecycle-command.js').ExecuteOutboundMarketplaceOrderLifecycleCommand} [deps.executeOutboundMarketplaceOrderLifecycle]
 * @param {import('../../modules/marketplace-order-ingestion/public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
 * @param {import('../../modules/channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
 * @param {import('../../modules/channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('../../modules/marketplace-order-ingestion/public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
 */
export function wireMarketplaceLifecycleWorker(deps) {
    const lifecycleEnqueueService = new MarketplaceLifecycleEnqueueService({
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
    const executeMarketplaceLifecycleJob = new ExecuteMarketplaceLifecycleJob({
        orderLifecycleProcessor,
        lifecycleService: deps.lifecycleService,
        channelQueryService: deps.channelQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        metrics: deps.metrics,
        logger: deps.logger,
        ...(deps.executeOutboundMarketplaceOrderLifecycle === undefined
            ? {}
            : { executeOutboundLifecycle: deps.executeOutboundMarketplaceOrderLifecycle }),
    });
    const fetchAndEnqueueMarketplaceOrderLifecycle = new FetchAndEnqueueMarketplaceOrderLifecycle({
        lifecycleEnqueueService,
        orderAdapterRegistry: deps.orderAdapterRegistry,
        marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory,
        channelQueryService: deps.channelQueryService,
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
