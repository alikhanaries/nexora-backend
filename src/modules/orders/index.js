import { DefaultAuthorizationService } from '../authorization/public/index.js';
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
import { PostgresOrderRepository } from './repositories/index.js';
import orderRoutes, {} from './controllers/order.routes.js';
export function createOrdersModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const orders = new PostgresOrderRepository();
    const orderFulfillmentService = createOrderFulfillmentService({
        orders,
        eventRecorder: deps.eventRecorder,
    });
    const orderQueryService = createOrderQueryService({
        authorization,
        queryable: deps.database,
        database: deps.database,
        orders,
    });
    const orderReturnGateway = createOrderReturnGateway({ orders });
    const sharedDeps = {
        authorization,
        database: deps.database,
        orders,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const orderCreationDeps = {
        ...sharedDeps,
        productQueryService: deps.productQueryService,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        offerQueryService: deps.offerQueryService,
        pricingService: deps.pricingService,
        inventoryService: deps.inventoryService,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
    };
    const createOrder = createCreateOrder(orderCreationDeps);
    const createIntegrationOrder = createCreateIntegrationOrder(orderCreationDeps);
    const confirmOrder = createConfirmOrder(sharedDeps);
    const acknowledgeOrder = createAcknowledgeOrder({
        ...sharedDeps,
        confirmOrder,
    });
    /** @type {{ execute: Function }|null} */
    let createIntegrationFulfilledOrder = null;
    const orderCommandService = createOrderCommandService({
        createOrder,
        createIntegrationOrder,
        get createIntegrationFulfilledOrder() {
            return createIntegrationFulfilledOrder;
        },
        acknowledgeOrder,
        idempotency: deps.idempotency,
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
            listShipmentsForOrder: shipmentDeps.listShipmentsForOrder,
        });
    }
    const useCases = {
        createOrder,
        confirmOrder,
        acknowledgeOrder,
        getOrder: createGetOrder({
            authorization,
            queryable: deps.database,
            orders,
        }),
        listOrders: createListOrders({
            authorization,
            queryable: deps.database,
            orders,
        }),
        idempotency: deps.idempotency,
    };
    return {
        orderCommandService,
        orderFulfillmentService,
        orderQueryService,
        orderReturnGateway,
        createOrder,
        createIntegrationOrder,
        wireChannelFulfilledOrder,
        useCases,
        routes: orderRoutes,
    };
}

// Marketplace order ingestion lives under ./marketplace-ingestion (not a top-level module).
export { createMarketplaceOrderIngestionModule } from './marketplace-ingestion/index.js';
