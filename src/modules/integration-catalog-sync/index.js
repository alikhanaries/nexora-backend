/**
 * Integration catalog sync: enqueue and execute channel catalog jobs (product, offer, price, inventory)
 * via marketplace adapters; optional reconciliation tick. Re-exports job planning helpers for workers.
 */
import { CatalogSyncEnqueueService } from './services/catalog-sync-enqueue-service.js';
import { CatalogSyncReconciliationService } from './services/catalog-sync-reconciliation-service.js';
import { IntegrationCatalogSyncService } from './services/integration-catalog-sync-service.js';
import { IntegrationCatalogSyncRateLimiter } from './services/integration-catalog-sync-rate-limiter.js';
import { ExecuteCatalogSyncJob } from './services/execute-catalog-sync-job.js';
import { SyncChannelInventory } from './services/sync-integration-inventory.js';
import { SyncChannelPrice } from './services/sync-integration-price.js';
import { SyncChannelProduct } from './services/sync-integration-product.js';
import { SyncChannelOffer } from './services/sync-integration-offer.js';
import { FoundationStubMarketplaceCatalogAdapter } from './repositories/foundation-stub-marketplace-catalog-adapter.js';
import { MarketplaceCatalogAdapterRegistry } from './public/marketplace-catalog-adapter-registry.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/queue/job-queue.js').JobQueue} deps.queue
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
 * @param {import('./services/marketplace-lookup.port.js').MarketplaceLookup} deps.marketplaceLookup
 * @param {import('../inventory/public/inventory-service.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../pricing/public/pricing-service.js').DefaultPricingService} deps.pricingService
 * @param {import('../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
 * @param {import('../marketplaces/services/marketplace-adapter-runtime-factory.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
 * @param {(registry: MarketplaceCatalogAdapterRegistry) => void} [deps.registerMarketplaceAdapters]
 * @param {import('./public/marketplace-entity-mapping-recorder.port.js').MarketplaceEntityMappingRecorder} [deps.marketplaceEntityMappingRecorder]
 * @param {{ enabled?: boolean, offerBatchSize?: number, maxJobsPerTick?: number }} [deps.catalogSyncReconciliation]
 * @returns {{ channelCatalogSyncService: IntegrationCatalogSyncService, catalogSyncReconciliationService: CatalogSyncReconciliationService, adapterRegistry: MarketplaceCatalogAdapterRegistry }}
 */
export function createIntegrationCatalogSyncModule(deps) {
    const adapterRegistry = new MarketplaceCatalogAdapterRegistry();
    adapterRegistry.register(new FoundationStubMarketplaceCatalogAdapter());
    deps.registerMarketplaceAdapters?.(adapterRegistry);
    const catalogSyncRateLimiter = new IntegrationCatalogSyncRateLimiter({
        rateLimiter: deps.rateLimiter,
    });
    const syncChannelInventory = new SyncChannelInventory({
        inventoryService: deps.inventoryService,
        offerQueryService: deps.offerQueryService,
        logger: deps.logger,
    });
    const syncChannelPrice = new SyncChannelPrice({
        pricingService: deps.pricingService,
        offerQueryService: deps.offerQueryService,
        logger: deps.logger,
    });
    const syncChannelProduct = new SyncChannelProduct({
        productQueryService: deps.productQueryService,
        offerQueryService: deps.offerQueryService,
    });
    const syncChannelOffer = new SyncChannelOffer({
        productQueryService: deps.productQueryService,
        offerQueryService: deps.offerQueryService,
    });
    const executeJob = new ExecuteCatalogSyncJob({
        database: deps.database,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        adapterRegistry,
        rateLimiter: catalogSyncRateLimiter,
        syncChannelInventory,
        syncChannelPrice,
        syncChannelProduct,
        syncChannelOffer,
        metrics: deps.metrics,
        logger: deps.logger,
        ...(deps.marketplaceAdapterRuntimeFactory === undefined
            ? {}
            : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
        ...(deps.marketplaceEntityMappingRecorder === undefined
            ? {}
            : { marketplaceEntityMappingRecorder: deps.marketplaceEntityMappingRecorder }),
    });
    const enqueueService = new CatalogSyncEnqueueService({
        queue: deps.queue,
        offerQueryService: deps.offerQueryService,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        pricingService: deps.pricingService,
        metrics: deps.metrics,
    });
    const channelCatalogSyncService = new IntegrationCatalogSyncService({
        enqueueService,
        executeJob,
    });
    const catalogSyncReconciliationConfig = deps.catalogSyncReconciliation ?? {
        enabled: false,
        offerBatchSize: 50,
        maxJobsPerTick: 500,
    };
    const catalogSyncReconciliationService = new CatalogSyncReconciliationService({
        database: deps.database,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        offerQueryService: deps.offerQueryService,
        enqueueService,
        pricingService: deps.pricingService,
        config: catalogSyncReconciliationConfig,
        logger: deps.logger,
        metrics: deps.metrics,
    });
    return {
        channelCatalogSyncService,
        catalogSyncReconciliationService,
        adapterRegistry,
    };
}

export { IntegrationCatalogSyncService } from './services/integration-catalog-sync-service.js';
export { FOUNDATION_STUB_MARKETPLACE_KEY } from './public/marketplace-catalog-adapter.port.js';
export { buildCatalogSyncJobId } from './services/build-catalog-sync-job-id.js';
export { planCatalogSyncJobsFromEvent } from './services/plan-catalog-sync-jobs.js';
export { catalogSyncJobPayloadSchema } from './services/catalog-sync-job.schema.js';
