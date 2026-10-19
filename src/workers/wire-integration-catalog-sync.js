import { CommerceIntegrationQueryService } from '../modules/commerce-integrations/public/index.js';
import { PostgresCommerceIntegrationRepository } from '../modules/commerce-integrations/repositories/postgres-commerce-integration-repository.js';
import { DefaultOfferQueryService } from '../modules/offers/public/offer-query-service.js';
import { PostgresOfferRepository } from '../modules/offers/repositories/postgres-offer-repository.js';
import { PostgresMarketplaceRepository } from '../modules/marketplaces/repositories/postgres-marketplace-repository.js';
import { createIntegrationCatalogSyncModule } from '../modules/integration-catalog-sync/index.js';
import { MarketplaceAdapterRuntimeFactory } from '../modules/marketplaces/services/marketplace-adapter-runtime-factory.js';
import { PostgresMarketplaceConnectionRepository } from '../modules/marketplaces/repositories/postgres-marketplace-connection-repository.js';
import { registerMarketplaceCatalogAdapters } from '../modules/marketplaces/repositories/adapters/register-marketplace-catalog-adapters.js';
import { createMarketplaceEntityMappingRecorder } from '../modules/marketplaces/services/create-marketplace-entity-mapping-recorder.js';
import { DefaultInventoryService } from '../modules/inventory/public/index.js';
import { PostgresInventoryRepository, PostgresStockLocationRepository, } from '../modules/inventory/repositories/index.js';
import { DefaultProductQueryService } from '../modules/products/public/index.js';
import { PostgresProductRepository } from '../modules/products/repositories/postgres-product-repository.js';
import { DefaultPricingService } from '../modules/pricing/public/index.js';
import { PostgresPriceRepository } from '../modules/pricing/repositories/index.js';

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
    const channelRepository = new PostgresCommerceIntegrationRepository();
    const commerceIntegrationQueryService = new CommerceIntegrationQueryService({
        queryable: deps.database,
        getCommerceIntegrationById: (tenantId, channelId, queryable) => channelRepository.findById(queryable, tenantId, channelId),
        getCommerceIntegrationByExternalReference: (tenantId, externalReference, queryable) => channelRepository.findByExternalReference(queryable, tenantId, externalReference),
        listCommerceIntegrations: (tenantId, filters, queryable) => channelRepository.list(queryable, tenantId, filters),
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
