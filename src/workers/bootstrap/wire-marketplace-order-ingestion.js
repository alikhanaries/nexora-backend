import { DefaultChannelQueryService } from '../../modules/channels/public/index.js';
import { PostgresChannelRepository } from '../../modules/channels/infrastructure/postgres-channel-repository.js';
import { PostgresMarketplaceRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { DefaultMarketplaceEntityMappingLookup } from '../../modules/marketplaces/public/index.js';
import { PostgresMarketplaceEntityMappingRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-entity-mapping-repository.js';
import { registerMarketplaceOrderAdapters } from '../../modules/marketplaces/infrastructure/adapters/register-marketplace-order-adapters.js';
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
 * @param {string | null | undefined} [deps.shopifyAdminApiVersion]
 * @param {string | null | undefined} [deps.amazonLwaTokenUrl]
 * @param {string | null | undefined} [deps.noonApiBaseUrl]
 * @param {string | null | undefined} [deps.noonUserAgent]
 * @param {import('../../modules/orders/infrastructure/postgres-order-repository.js').PostgresOrderRepository} [deps.orders]
 * @param {import('../../modules/orders/application/confirm-order.js').ConfirmOrder} [deps.confirmOrder]
 * @param {import('../../modules/cancellations/public/cancellation-command-service.js').DefaultCancellationCommandService} [deps.cancellationCommandService]
 * @param {import('../../modules/returns/public/return-command-service.js').DefaultReturnCommandService} [deps.returnCommandService]
 * @param {import('../../modules/shipments/public/shipment-command-service.js').DefaultShipmentCommandService} [deps.shipmentCommandService]
 * @param {{ execute: (input: object) => Promise<{ shipment: object }> }} [deps.shipShipment]
 * @param {import('../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
 */
export function wireMarketplaceOrderIngestion(deps) {
    const registerOrderAdapters = deps.registerMarketplaceOrderAdapters ??
        ((registry) => registerMarketplaceOrderAdapters(registry, {
            shopifyAdminApiVersion: deps.shopifyAdminApiVersion,
            amazonLwaTokenUrl: deps.amazonLwaTokenUrl,
            noonApiBaseUrl: deps.noonApiBaseUrl,
            noonUserAgent: deps.noonUserAgent,
        }));
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
        registerMarketplaceOrderAdapters: registerOrderAdapters,
        ...(deps.marketplaceAdapterRuntimeFactory === undefined
            ? {}
            : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
        ...(deps.orders === undefined ? {} : { orders: deps.orders }),
        ...(deps.confirmOrder === undefined ? {} : { confirmOrder: deps.confirmOrder }),
        ...(deps.cancellationCommandService === undefined
            ? {}
            : { cancellationCommandService: deps.cancellationCommandService }),
        ...(deps.returnCommandService === undefined ? {} : { returnCommandService: deps.returnCommandService }),
        ...(deps.shipmentCommandService === undefined
            ? {}
            : { shipmentCommandService: deps.shipmentCommandService }),
        ...(deps.shipShipment === undefined ? {} : { shipShipment: deps.shipShipment }),
        ...(deps.idempotency === undefined ? {} : { idempotency: deps.idempotency }),
    });
}
