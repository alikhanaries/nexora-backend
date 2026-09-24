import { DefaultChannelQueryService } from '../../modules/channels/public/index.js';
import { PostgresChannelRepository } from '../../modules/channels/infrastructure/postgres-channel-repository.js';
import { DefaultOfferQueryService } from '../../modules/offers/public/offer-query-service.js';
import { PostgresOfferRepository } from '../../modules/offers/infrastructure/postgres-offer-repository.js';
import { PostgresMarketplaceRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { createChannelCatalogSyncModule } from '../../modules/channel-catalog-sync/index.js';

/**
 * Worker-only wiring for channel catalog sync query ports (composition root).
 *
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/queue/job-queue.js').JobQueue} deps.queue
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 */
export function wireChannelCatalogSync(deps) {
    const channelRepository = new PostgresChannelRepository();
    const channelQueryService = new DefaultChannelQueryService({
        queryable: deps.database,
        getChannelById: (tenantId, channelId, queryable) => channelRepository.findById(queryable, tenantId, channelId),
        getChannelByExternalReference: (tenantId, externalReference, queryable) => channelRepository.findByExternalReference(queryable, tenantId, externalReference),
        listChannels: (tenantId, filters, queryable) => channelRepository.list(queryable, tenantId, filters),
    });
    const offerRepository = new PostgresOfferRepository();
    const offerQueryService = new DefaultOfferQueryService({
        queryable: deps.database,
        offers: offerRepository,
    });
    const marketplaceRepository = new PostgresMarketplaceRepository();
    const marketplaceLookup = {
        findById: async (marketplaceId) => {
            const marketplace = await marketplaceRepository.findById(deps.database, marketplaceId);
            if (marketplace === null) {
                return null;
            }
            return {
                id: marketplace.id,
                key: marketplace.key,
                status: marketplace.status,
            };
        },
    };
    return createChannelCatalogSyncModule({
        database: deps.database,
        queue: deps.queue,
        rateLimiter: deps.rateLimiter,
        metrics: deps.metrics,
        logger: deps.logger,
        channelQueryService,
        offerQueryService,
        marketplaceLookup,
    });
}
