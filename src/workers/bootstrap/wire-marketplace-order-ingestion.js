import { DefaultChannelQueryService } from '../../modules/channels/public/index.js';
import { PostgresChannelRepository } from '../../modules/channels/infrastructure/postgres-channel-repository.js';
import { PostgresMarketplaceRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { DefaultMarketplaceEntityMappingLookup } from '../../modules/marketplaces/public/index.js';
import { PostgresMarketplaceEntityMappingRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-entity-mapping-repository.js';
import { createMarketplaceOrderIngestionModule } from '../../modules/marketplace-order-ingestion/index.js';
import { DefaultProductQueryService } from '../../modules/products/public/index.js';
import { PostgresProductRepository } from '../../modules/products/infrastructure/postgres-product-repository.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} deps.metrics
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../../modules/orders/public/index.js').CreateChannelOrder} deps.createChannelOrder
 * @param {import('../../modules/channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
 * @param {(registry: import('../../modules/marketplace-order-ingestion/public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry) => void} [deps.registerMarketplaceOrderAdapters]
 */
export function wireMarketplaceOrderIngestion(deps) {
    const channelRepository = new PostgresChannelRepository();
    const channelQueryService = new DefaultChannelQueryService({
        queryable: deps.database,
        getChannelById: (tenantId, channelId, queryable) => channelRepository.findById(queryable, tenantId, channelId),
        getChannelByExternalReference: (tenantId, externalReference, queryable) => channelRepository.findByExternalReference(queryable, tenantId, externalReference),
        listChannels: (tenantId, filters, queryable) => channelRepository.list(queryable, tenantId, filters),
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
    const productQueryService = new DefaultProductQueryService({
        queryable: deps.database,
        products: new PostgresProductRepository(),
    });
    const marketplaceEntityMappingLookup = new DefaultMarketplaceEntityMappingLookup({
        mappings: new PostgresMarketplaceEntityMappingRepository(),
        queryable: deps.database,
    });
    return createMarketplaceOrderIngestionModule({
        database: deps.database,
        channelQueryService,
        marketplaceLookup,
        createChannelOrder: deps.createChannelOrder,
        marketplaceEntityMappingLookup,
        productQueryService,
        metrics: deps.metrics,
        logger: deps.logger,
        ...(deps.marketplaceAdapterRuntimeFactory === undefined
            ? {}
            : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
        ...(deps.registerMarketplaceOrderAdapters === undefined
            ? {}
            : { registerMarketplaceOrderAdapters: deps.registerMarketplaceOrderAdapters }),
    });
}
