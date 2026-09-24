import { DefaultChannelQueryService } from '../../modules/channels/public/index.js';
import { PostgresChannelRepository } from '../../modules/channels/infrastructure/postgres-channel-repository.js';
import { DefaultOfferQueryService } from '../../modules/offers/public/offer-query-service.js';
import { PostgresOfferRepository } from '../../modules/offers/infrastructure/postgres-offer-repository.js';
import { PostgresMarketplaceRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { createChannelCatalogSyncModule } from '../../modules/channel-catalog-sync/index.js';
import { DefaultInventoryService } from '../../modules/inventory/public/index.js';
import { PostgresInventoryRepository, PostgresStockLocationRepository, } from '../../modules/inventory/infrastructure/index.js';
import { DefaultProductQueryService } from '../../modules/products/public/index.js';
import { PostgresProductRepository } from '../../modules/products/infrastructure/postgres-product-repository.js';
import { DefaultPricingService } from '../../modules/pricing/public/index.js';
import { PostgresPriceRepository } from '../../modules/pricing/infrastructure/index.js';

/**
 * Worker-only wiring for channel catalog sync query ports (composition root).
 *
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/queue/job-queue.js').JobQueue} deps.queue
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {{ enabled: boolean, offerBatchSize: number, maxJobsPerTick: number }} [deps.catalogSyncReconciliation]
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
    const productRepository = new PostgresProductRepository();
    const productQueryService = new DefaultProductQueryService({
        database: deps.database,
        products: productRepository,
    });
    const inventoryService = new DefaultInventoryService({
        transactionManager: deps.database,
        queryable: deps.database,
        inventoryRepository: new PostgresInventoryRepository(),
        stockLocationRepository: new PostgresStockLocationRepository(),
        productQueryService,
        eventRecorder: {
            recordIntegrationEvent: async () => {},
            recordDomainEvent: async () => {},
        },
    });
    const noopEventRecorder = {
        record: async () => {},
        recordIntegrationEvent: async () => {},
        recordDomainEvent: async () => {},
    };
    const pricingService = new DefaultPricingService({
        transactionManager: deps.database,
        queryable: deps.database,
        prices: new PostgresPriceRepository(),
        productQueryService,
        channelQueryService,
        eventRecorder: noopEventRecorder,
    });
    return createChannelCatalogSyncModule({
        database: deps.database,
        queue: deps.queue,
        rateLimiter: deps.rateLimiter,
        metrics: deps.metrics,
        logger: deps.logger,
        channelQueryService,
        offerQueryService,
        marketplaceLookup,
        inventoryService,
        pricingService,
        productQueryService,
    });
}
