import { createDefaultCommerceIntegrationQueryService } from '../modules/commerce-integrations/public/index.js';
import { createDefaultOfferQueryService } from '../modules/offers/public/offer-query-service.js';
import { createPostgresOfferRepository } from '../modules/offers/repositories/index.js';
import { PostgresMarketplaceRepository } from '../modules/marketplaces/repositories/postgres-marketplace-repository.js';
import { createIntegrationCatalogSyncModule } from '../modules/integration-catalog-sync/index.js';
import { MarketplaceAdapterRuntimeFactory } from '../modules/marketplaces/services/marketplace-adapter-runtime-factory.js';
import { PostgresMarketplaceConnectionRepository } from '../modules/marketplaces/repositories/postgres-marketplace-connection-repository.js';
import { registerMarketplaceCatalogAdapters } from '../modules/marketplaces/repositories/adapters/register-marketplace-catalog-adapters.js';
import { createMarketplaceEntityMappingRecorder } from '../modules/marketplaces/services/create-marketplace-entity-mapping-recorder.js';
import { createDefaultInventoryService } from '../modules/inventory/public/index.js';
import { createPostgresInventoryRepository, createPostgresStockLocationRepository, } from '../modules/inventory/repositories/index.js';
import { createDefaultProductQueryService } from '../modules/products/public/index.js';
import { createPostgresProductRepository } from '../modules/products/repositories/index.js';
import { createDefaultPricingService } from '../modules/pricing/public/index.js';
import { createPostgresPriceRepository } from '../modules/pricing/repositories/index.js';

/**
 * Worker-only wiring for channel catalog sync query ports (composition root).
 *
 * @param {object} deps
 * @param {import('../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../shared/queue/job-queue.js').JobQueue} deps.queue
 * @param {import('../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {import('../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../shared/logging/logger.port.js').Logger} deps.logger
 * @param {{ enabled: boolean, offerBatchSize: number, maxJobsPerTick: number }} [deps.catalogSyncReconciliation]
 * @param {import('../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
 * @param {string | null | undefined} [deps.shopifyAdminApiVersion]
 */
export function wireIntegrationCatalogSync(deps) {
    const commerceIntegrationQueryService = createDefaultCommerceIntegrationQueryService({
        database: deps.database,
    });
    const offerRepository = createPostgresOfferRepository();
    const offerQueryService = createDefaultOfferQueryService({
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
    const productRepository = createPostgresProductRepository();
    const productQueryService = createDefaultProductQueryService({
        database: deps.database,
        products: productRepository,
    });
    const inventoryService = createDefaultInventoryService({
        transactionManager: deps.database,
        queryable: deps.database,
        inventoryRepository: createPostgresInventoryRepository(),
        stockLocationRepository: createPostgresStockLocationRepository(),
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
    const pricingService = createDefaultPricingService({
        transactionManager: deps.database,
        queryable: deps.database,
        prices: createPostgresPriceRepository(),
        productQueryService,
        commerceIntegrationQueryService,
        eventRecorder: noopEventRecorder,
    });
    const marketplaceConnections = new PostgresMarketplaceConnectionRepository();
    const marketplaceAdapterRuntimeFactory = new MarketplaceAdapterRuntimeFactory({
        connections: marketplaceConnections,
        secretEncryptor: deps.secretEncryptor,
        queryable: deps.database,
        shopifyAdminApiVersion: deps.shopifyAdminApiVersion,
    });
    return createIntegrationCatalogSyncModule({
        database: deps.database,
        queue: deps.queue,
        rateLimiter: deps.rateLimiter,
        metrics: deps.metrics,
        logger: deps.logger,
        commerceIntegrationQueryService,
        offerQueryService,
        marketplaceLookup,
        inventoryService,
        pricingService,
        productQueryService,
        marketplaceAdapterRuntimeFactory,
        registerMarketplaceAdapters: (registry) => registerMarketplaceCatalogAdapters(registry, {
            amazonLwaTokenUrl: deps.amazonLwaTokenUrl,
            noonApiBaseUrl: deps.noonApiBaseUrl,
            noonUserAgent: deps.noonUserAgent,
        }),
        marketplaceEntityMappingRecorder: createMarketplaceEntityMappingRecorder(),
    });
}
