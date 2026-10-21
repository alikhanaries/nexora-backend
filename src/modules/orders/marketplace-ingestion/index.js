/**
 * Marketplace order ingestion and optional lifecycle processing: adapter registry, normalized order ingest,
 * pull-based fetch, and confirm/cancel/return/shipment operations when order domain deps are supplied.
 */
import { createExecuteMarketplaceOrderLifecycleOperation } from './services/execute-marketplace-order-lifecycle-operation.js';
import { createFetchAndIngestMarketplaceOrders } from './services/fetch-and-ingest-marketplace-orders.js';
import { createIngestNormalizedMarketplaceOrder } from './services/ingest-normalized-marketplace-order.js';
import { createMarketplaceOrderIngestionService } from './services/marketplace-order-ingestion-service.js';
import { createMarketplaceOrderLifecycleService } from './services/marketplace-order-lifecycle-service.js';
import { createProcessMarketplaceLifecyclePayload } from './services/process-marketplace-lifecycle-payload.js';
import { createEnsureMarketplaceOrderIngestedFromLifecycle } from './services/ensure-marketplace-order-ingested-from-lifecycle.js';
import { createMarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';

/**
 * @param {object} deps
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('./public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
 * @param {{ execute: Function }} deps.createIntegrationOrder
 * @param {import('./public/marketplace-entity-mapping-lookup.port.js').MarketplaceEntityMappingLookup} deps.marketplaceEntityMappingLookup
 * @param {import('../../products/public/index.js').ProductQueryService} deps.productQueryService
 * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
 * @param {import('../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
 * @param {(registry: ReturnType<typeof createMarketplaceOrderAdapterRegistry>) => void} [deps.registerMarketplaceOrderAdapters]
 * @param {ReturnType<import('../repositories/postgres-order-repository.js').createPostgresOrderRepository>} [deps.orders]
 * @param {{ execute: Function }} [deps.confirmOrder]
 * @param {{ createCancellation: Function }} [deps.cancellationCommandService]
 * @param {{ createReturn: Function }} [deps.returnCommandService]
 * @param {{ createShipment: Function }} [deps.shipmentCommandService]
 * @param {{ execute: (input: object) => Promise<{ shipment: object }> }} [deps.shipShipment]
 * @param {import('../../../shared/idempotency/idempotency-service.js')} [deps.idempotency]
 * @returns {{ ingestionService: object, ingestNormalizedMarketplaceOrder: Function, fetchAndIngestMarketplaceOrders?: Function, lifecycleService?: object, processMarketplaceLifecyclePayload?: Function, orderAdapterRegistry: ReturnType<typeof createMarketplaceOrderAdapterRegistry> }}
 */
export function createMarketplaceOrderIngestionModule(deps) {
    const orderAdapterRegistry = createMarketplaceOrderAdapterRegistry();
    deps.registerMarketplaceOrderAdapters?.(orderAdapterRegistry);
    const ingestionService = createMarketplaceOrderIngestionService({
        database: deps.database,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        createIntegrationOrder: deps.createIntegrationOrder,
        marketplaceEntityMappingLookup: deps.marketplaceEntityMappingLookup,
        productQueryService: deps.productQueryService,
        metrics: deps.metrics,
        logger: deps.logger,
    });
    const ingestNormalizedMarketplaceOrder = createIngestNormalizedMarketplaceOrder({
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
        : createFetchAndIngestMarketplaceOrders({
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
        ? createExecuteMarketplaceOrderLifecycleOperation({
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
        ? createMarketplaceOrderLifecycleService({
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
        ? createEnsureMarketplaceOrderIngestedFromLifecycle({
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
        : createProcessMarketplaceLifecyclePayload({
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

export { createMarketplaceOrderIngestionService } from './services/marketplace-order-ingestion-service.js';
export { createMarketplaceOrderLifecycleService } from './services/marketplace-order-lifecycle-service.js';
export { normalizedMarketplaceOrderSchema } from './services/normalized-marketplace-order.schema.js';
export { normalizedMarketplaceLifecycleCommandSchema } from './services/normalized-marketplace-lifecycle-command.schema.js';
export { MarketplaceOrderLifecycleOperation } from './models/marketplace-order-lifecycle-operation.js';
export { MarketplaceOrderLifecycleOutcome } from './models/marketplace-order-lifecycle-outcome.js';
export { createMarketplaceOrderAdapterRegistry } from './public/marketplace-order-adapter-registry.js';
