import { ExecuteMarketplaceOrderLifecycleOperation } from './services/execute-marketplace-order-lifecycle-operation.js';
import { FetchAndIngestMarketplaceOrders } from './services/fetch-and-ingest-marketplace-orders.js';
import { IngestNormalizedMarketplaceOrder } from './services/ingest-normalized-marketplace-order.js';
import { MarketplaceOrderIngestionService } from './services/marketplace-order-ingestion-service.js';
import { MarketplaceOrderLifecycleService } from './services/marketplace-order-lifecycle-service.js';
import { ProcessMarketplaceLifecyclePayload } from './services/process-marketplace-lifecycle-payload.js';
import { EnsureMarketplaceOrderIngestedFromLifecycle } from './services/ensure-marketplace-order-ingested-from-lifecycle.js';
import { MarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';

/**
 * @param {object} deps
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('./public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
 * @param {import('../public/index.js').CreateIntegrationOrder} deps.createIntegrationOrder
 * @param {import('./public/marketplace-entity-mapping-lookup.port.js').MarketplaceEntityMappingLookup} deps.marketplaceEntityMappingLookup
 * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
 * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
 * @param {import('../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
 * @param {(registry: MarketplaceOrderAdapterRegistry) => void} [deps.registerMarketplaceOrderAdapters]
 * @param {import('../repositories/postgres-order-repository.js').PostgresOrderRepository} [deps.orders]
 * @param {import('../services/confirm-order.js').ConfirmOrder} [deps.confirmOrder]
 * @param {import('../../cancellations/public/cancellation-command-service.js').DefaultCancellationCommandService} [deps.cancellationCommandService]
 * @param {import('../../returns/public/return-command-service.js').DefaultReturnCommandService} [deps.returnCommandService]
 * @param {import('../../shipments/public/shipment-command-service.js').DefaultShipmentCommandService} [deps.shipmentCommandService]
 * @param {{ execute: (input: object) => Promise<{ shipment: object }> }} [deps.shipShipment]
 * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
 */
export function createMarketplaceOrderIngestionModule(deps) {
    const orderAdapterRegistry = new MarketplaceOrderAdapterRegistry();
    deps.registerMarketplaceOrderAdapters?.(orderAdapterRegistry);
    const ingestionService = new MarketplaceOrderIngestionService({
        database: deps.database,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        createIntegrationOrder: deps.createIntegrationOrder,
        marketplaceEntityMappingLookup: deps.marketplaceEntityMappingLookup,
        productQueryService: deps.productQueryService,
        metrics: deps.metrics,
        logger: deps.logger,
    });
    const ingestNormalizedMarketplaceOrder = new IngestNormalizedMarketplaceOrder({
        ingestionService,
        orderAdapterRegistry,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
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
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
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
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
            marketplaceLookup: deps.marketplaceLookup,
            orders: deps.orders,
            executeOperation: executeLifecycleOperation,
            orderAdapterRegistry,
            ...(deps.idempotency === undefined ? {} : { idempotency: deps.idempotency }),
            metrics: deps.metrics,
            logger: deps.logger,
        })
        : undefined;
    const ensureMarketplaceOrderIngestedFromLifecycle = lifecycleEnabled
        ? new EnsureMarketplaceOrderIngestedFromLifecycle({
            ingestNormalizedMarketplaceOrder,
            orderAdapterRegistry,
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
            orders: deps.orders,
            database: deps.database,
            ...(deps.marketplaceAdapterRuntimeFactory === undefined
                ? {}
                : { marketplaceAdapterRuntimeFactory: deps.marketplaceAdapterRuntimeFactory }),
        })
        : undefined;
    const processMarketplaceLifecyclePayload = lifecycleService === undefined
        ? undefined
        : new ProcessMarketplaceLifecyclePayload({
            lifecycleService,
            orderAdapterRegistry,
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
            database: deps.database,
            ...(ensureMarketplaceOrderIngestedFromLifecycle === undefined
                ? {}
                : { ensureMarketplaceOrderIngestedFromLifecycle }),
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

export { MarketplaceOrderIngestionService } from './services/marketplace-order-ingestion-service.js';
export { MarketplaceOrderLifecycleService } from './services/marketplace-order-lifecycle-service.js';
export { normalizedMarketplaceOrderSchema } from './services/normalized-marketplace-order.schema.js';
export { normalizedMarketplaceLifecycleCommandSchema } from './services/normalized-marketplace-lifecycle-command.schema.js';
export { MarketplaceOrderLifecycleOperation } from './models/marketplace-order-lifecycle-operation.js';
export { MarketplaceOrderLifecycleOutcome } from './models/marketplace-order-lifecycle-outcome.js';
export { MarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';
