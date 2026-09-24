import { CatalogSyncEnqueueService } from './application/catalog-sync-enqueue-service.js';
import { ChannelCatalogSyncService } from './application/channel-catalog-sync-service.js';
import { ChannelCatalogSyncRateLimiter } from './application/channel-catalog-sync-rate-limiter.js';
import { ExecuteCatalogSyncJob } from './application/execute-catalog-sync-job.js';
import { FoundationStubMarketplaceCatalogAdapter } from './infrastructure/foundation-stub-marketplace-catalog-adapter.js';
import { MarketplaceCatalogAdapterRegistry } from './infrastructure/marketplace-catalog-adapter-registry.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/queue/job-queue.js').JobQueue} deps.queue
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
 * @param {import('./application/marketplace-lookup.port.js').MarketplaceLookup} deps.marketplaceLookup
 */
export function createChannelCatalogSyncModule(deps) {
    const adapterRegistry = new MarketplaceCatalogAdapterRegistry();
    adapterRegistry.register(new FoundationStubMarketplaceCatalogAdapter());
    const catalogSyncRateLimiter = new ChannelCatalogSyncRateLimiter({
        rateLimiter: deps.rateLimiter,
    });
    const executeJob = new ExecuteCatalogSyncJob({
        database: deps.database,
        channelQueryService: deps.channelQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        adapterRegistry,
        rateLimiter: catalogSyncRateLimiter,
        metrics: deps.metrics,
        logger: deps.logger,
    });
    const enqueueService = new CatalogSyncEnqueueService({
        queue: deps.queue,
        offerQueryService: deps.offerQueryService,
        channelQueryService: deps.channelQueryService,
        metrics: deps.metrics,
    });
    const channelCatalogSyncService = new ChannelCatalogSyncService({
        enqueueService,
        executeJob,
    });
    return {
        channelCatalogSyncService,
        adapterRegistry,
    };
}

export { ChannelCatalogSyncService } from './application/channel-catalog-sync-service.js';
export { FOUNDATION_STUB_MARKETPLACE_KEY } from './public/marketplace-catalog-adapter.port.js';
export { buildCatalogSyncJobId } from './application/build-catalog-sync-job-id.js';
export { planCatalogSyncJobsFromEvent } from './application/plan-catalog-sync-jobs.js';
export { catalogSyncJobPayloadSchema } from './application/catalog-sync-job.schema.js';
