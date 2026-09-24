import { IngestNormalizedMarketplaceOrder } from './application/ingest-normalized-marketplace-order.js';
import { MarketplaceOrderIngestionService } from './application/marketplace-order-ingestion-service.js';
import { MarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('./public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
 * @param {import('../orders/public/index.js').CreateChannelOrder} deps.createChannelOrder
 * @param {import('./public/marketplace-entity-mapping-lookup.port.js').MarketplaceEntityMappingLookup} deps.marketplaceEntityMappingLookup
 * @param {import('../products/public/index.js').ProductQueryService} deps.productQueryService
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../shared/logging/logger.port.js').Logger} [deps.logger]
 * @param {import('../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
 * @param {(registry: MarketplaceOrderAdapterRegistry) => void} [deps.registerMarketplaceOrderAdapters]
 */
export function createMarketplaceOrderIngestionModule(deps) {
    const orderAdapterRegistry = new MarketplaceOrderAdapterRegistry();
    deps.registerMarketplaceOrderAdapters?.(orderAdapterRegistry);
    const ingestionService = new MarketplaceOrderIngestionService({
        database: deps.database,
        channelQueryService: deps.channelQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        createChannelOrder: deps.createChannelOrder,
        marketplaceEntityMappingLookup: deps.marketplaceEntityMappingLookup,
        productQueryService: deps.productQueryService,
        metrics: deps.metrics,
        logger: deps.logger,
    });
    const ingestNormalizedMarketplaceOrder = new IngestNormalizedMarketplaceOrder({
        ingestionService,
        orderAdapterRegistry,
        database: deps.database,
        ...(deps.marketplaceAdapterRuntimeFactory === undefined
            ? {}
            : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
    });
    return {
        ingestionService,
        ingestNormalizedMarketplaceOrder,
        orderAdapterRegistry,
    };
}

export { MarketplaceOrderIngestionService } from './application/marketplace-order-ingestion-service.js';
export { normalizedMarketplaceOrderSchema } from './application/normalized-marketplace-order.schema.js';
export { MarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';
