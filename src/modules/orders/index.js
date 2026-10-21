/**
 * Orders domain: manual and integration order creation, confirmation, queries, and command/query services.
 * Re-exports marketplace order ingestion factory from `./marketplace-ingestion`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import { createAcknowledgeOrder } from './services/acknowledge-order.js';
import { createConfirmOrder } from './services/confirm-order.js';
import { createCreateIntegrationFulfilledOrder } from './services/create-integration-fulfilled-order.js';
import { createCreateIntegrationOrder } from './services/create-integration-order.js';
import { createCreateOrder } from './services/create-order.js';
import { createGetOrder } from './services/get-order.js';
import { createListOrders } from './services/list-orders.js';
import { createOrderCommandService } from './services/order-command-service.js';
import { createOrderFulfillmentService } from './services/order-fulfillment-service.js';
import { createOrderQueryService } from './services/order-query-service.js';
import { createOrderReturnGateway } from './services/order-return-gateway.js';
import { createPostgresOrderRepository } from './repositories/index.js';
/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('../products/public/index.js').DefaultProductQueryService} deps.productQueryService
 * @param {import('../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../offers/public/index.js').DefaultOfferQueryService} deps.offerQueryService
 * @param {import('../pricing/public/index.js').DefaultPricingService} deps.pricingService
 * @param {import('../inventory/public/index.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../external-id-mapping/public/index.js').ExternalIntegerIdMappingCommandService} deps.externalIntegerIdMappingCommandService
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ orderCommandService: object, orderFulfillmentService: object, orderQueryService: object, orderReturnGateway: object, createOrder: Function, createIntegrationOrder: Function, wireChannelFulfilledOrder: Function, useCases: object }}
 */
export function createOrdersModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const orders = createPostgresOrderRepository();
    const orderFulfillmentService = createOrderFulfillmentService({
        orders,
        eventRecorder: deps.eventRecorder
    });
    const orderQueryService = createOrderQueryService({
        authorization,
        queryable: deps.database,
        database: deps.database,
        orders
    });
    const orderReturnGateway = createOrderReturnGateway({ orders });
    const sharedDeps = {
        authorization,
        database: deps.database,
        orders,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const orderCreationDeps = {
        ...sharedDeps,
        productQueryService: deps.productQueryService,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        offerQueryService: deps.offerQueryService,
        pricingService: deps.pricingService,
        inventoryService: deps.inventoryService,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService
    };
    const createOrder = createCreateOrder(orderCreationDeps);
    const createIntegrationOrder = createCreateIntegrationOrder(orderCreationDeps);
    const confirmOrder = createConfirmOrder(sharedDeps);
    const acknowledgeOrder = createAcknowledgeOrder({
        ...sharedDeps,
        confirmOrder
    });
    /** @type {{ execute: Function }|null} */
    let createIntegrationFulfilledOrder = null;
    const orderCommandService = createOrderCommandService({
        createOrder,
        createIntegrationOrder,
        /**
         * Factory wiring for channel-fulfilled order ingest (permissions, idempotency on external ref, events).
         */
        get createIntegrationFulfilledOrder() {
            return createIntegrationFulfilledOrder;
        },
        acknowledgeOrder,
        idempotency: deps.idempotency
    });
    /**
     * @param {object} shipmentDeps
     * @param {{ execute: Function }} shipmentDeps.createShipment
     * @param {{ execute: Function }} shipmentDeps.shipShipment
     * @param {(tx: object, tenantId: string, orderId: string) => Promise<object[]>} shipmentDeps.listShipmentsForOrder
     */
    function wireChannelFulfilledOrder(shipmentDeps) {
        createIntegrationFulfilledOrder = createCreateIntegrationFulfilledOrder({
            ...orderCreationDeps,
            createShipment: shipmentDeps.createShipment,
            shipShipment: shipmentDeps.shipShipment,
            listShipmentsForOrder: shipmentDeps.listShipmentsForOrder
        });
    }
    const useCases = {
        createOrder,
        confirmOrder,
        acknowledgeOrder,
        getOrder: createGetOrder({
            authorization,
            queryable: deps.database,
            orders
        }),
        listOrders: createListOrders({
            authorization,
            queryable: deps.database,
            orders
        }),
        idempotency: deps.idempotency
    };
    return {
        orderCommandService,
        orderFulfillmentService,
        orderQueryService,
        orderReturnGateway,
        createOrder,
        createIntegrationOrder,
        wireChannelFulfilledOrder,
        useCases
    };
}

// Marketplace order ingestion lives under ./marketplace-ingestion (not a top-level module).
export { createMarketplaceOrderIngestionModule } from './marketplace-ingestion/index.js';
