import { ExecuteMarketplaceOrderLifecycleOperation } from './application/execute-marketplace-order-lifecycle-operation.js';
import { FetchAndIngestMarketplaceOrders } from './application/fetch-and-ingest-marketplace-orders.js';
import { IngestNormalizedMarketplaceOrder } from './application/ingest-normalized-marketplace-order.js';
import { MarketplaceOrderIngestionService } from './application/marketplace-order-ingestion-service.js';
import { MarketplaceOrderLifecycleService } from './application/marketplace-order-lifecycle-service.js';
import { ProcessMarketplaceLifecyclePayload } from './application/process-marketplace-lifecycle-payload.js';
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
 * @param {import('../orders/infrastructure/postgres-order-repository.js').PostgresOrderRepository} [deps.orders]
 * @param {import('../orders/application/confirm-order.js').ConfirmOrder} [deps.confirmOrder]
 * @param {import('../cancellations/public/cancellation-command-service.js').DefaultCancellationCommandService} [deps.cancellationCommandService]
 * @param {import('../returns/public/return-command-service.js').DefaultReturnCommandService} [deps.returnCommandService]
 * @param {import('../shipments/public/shipment-command-service.js').DefaultShipmentCommandService} [deps.shipmentCommandService]
 * @param {{ execute: (input: object) => Promise<{ shipment: object }> }} [deps.shipShipment]
 * @param {import('../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
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
        channelQueryService: deps.channelQueryService,
        database: deps.database,
        ...(deps.marketplaceAdapterRuntimeFactory === undefined
            ? {}
            : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
    });
    const fetchAndIngestMarketplaceOrders = deps.marketplaceAdapterRuntimeFactory === undefined
        ? undefined
        : new FetchAndIngestMarketplaceOrders({
            ingestNormalizedMarketplaceOrder,
            orderAdapterRegistry,
            channelQueryService: deps.channelQueryService,
            marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory,
            database: deps.database,
        });
    const lifecycleEnabled = deps.orders !== undefined
        && deps.confirmOrder !== undefined
        && deps.cancellationCommandService !== undefined;
    const executeLifecycleOperation = lifecycleEnabled
        ? new ExecuteMarketplaceOrderLifecycleOperation({
            orders: deps.orders,
            productQueryService: deps.productQueryService,
            confirmOrder: deps.confirmOrder,
            cancellationCommandService: deps.cancellationCommandService,
            ...(deps.returnCommandService === undefined ? {} : { returnCommandService: deps.returnCommandService }),
            ...(deps.shipmentCommandService === undefined ? {} : { shipmentCommandService: deps.shipmentCommandService }),
            ...(deps.shipShipment === undefined ? {} : { shipShipment: deps.shipShipment }),
        })
        : undefined;
    const lifecycleService = lifecycleEnabled
        ? new MarketplaceOrderLifecycleService({
            database: deps.database,
            channelQueryService: deps.channelQueryService,
            marketplaceLookup: deps.marketplaceLookup,
            orders: deps.orders,
            executeOperation: executeLifecycleOperation,
            orderAdapterRegistry,
            ...(deps.idempotency === undefined ? {} : { idempotency: deps.idempotency }),
            metrics: deps.metrics,
            logger: deps.logger,
        })
        : undefined;
    const processMarketplaceLifecyclePayload = lifecycleService === undefined
        ? undefined
        : new ProcessMarketplaceLifecyclePayload({
            lifecycleService,
            orderAdapterRegistry,
            channelQueryService: deps.channelQueryService,
            database: deps.database,
            ...(deps.marketplaceAdapterRuntimeFactory === undefined
                ? {}
                : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
        });
    return {
        ingestionService,
        ingestNormalizedMarketplaceOrder,
        ...(fetchAndIngestMarketplaceOrders === undefined
            ? {}
            : { fetchAndIngestMarketplaceOrders }),
        ...(lifecycleService === undefined ? {} : { lifecycleService }),
        ...(processMarketplaceLifecyclePayload === undefined ? {} : { processMarketplaceLifecyclePayload }),
        orderAdapterRegistry,
    };
}

export { MarketplaceOrderIngestionService } from './application/marketplace-order-ingestion-service.js';
export { MarketplaceOrderLifecycleService } from './application/marketplace-order-lifecycle-service.js';
export { normalizedMarketplaceOrderSchema } from './application/normalized-marketplace-order.schema.js';
export { normalizedMarketplaceLifecycleCommandSchema } from './application/normalized-marketplace-lifecycle-command.schema.js';
export { MarketplaceOrderLifecycleOperation } from './domain/marketplace-order-lifecycle-operation.js';
export { MarketplaceOrderLifecycleOutcome } from './domain/marketplace-order-lifecycle-outcome.js';
export { MarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';
