import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { AcknowledgeOrder } from './services/acknowledge-order.js';
import { ConfirmOrder } from './services/confirm-order.js';
import { CreateIntegrationFulfilledOrder } from './services/create-integration-fulfilled-order.js';
import { CreateIntegrationOrder } from './services/create-integration-order.js';
import { CreateOrder } from './services/create-order.js';
import { createGetOrder } from './services/get-order.js';
import { createListOrders } from './services/list-orders.js';
import { DefaultOrderCommandService } from './services/order-command-service.js';
import { DefaultOrderFulfillmentService } from './services/order-fulfillment-service.js';
import { createOrderQueryService } from './services/order-query-service.js';
import { DefaultOrderReturnGateway } from './services/order-return-gateway.js';
import { PostgresOrderRepository } from './repositories/index.js';
import orderRoutes, {} from './controllers/order.routes.js';
export function createOrdersModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const orders = new PostgresOrderRepository();
    const orderFulfillmentService = new DefaultOrderFulfillmentService({
        orders,
        eventRecorder: deps.eventRecorder,
    });
    const orderQueryService = createOrderQueryService({
        authorization,
        queryable: deps.database,
        database: deps.database,
        orders,
    });
    const orderReturnGateway = new DefaultOrderReturnGateway({ orders });
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
    const createOrder = new CreateOrder(orderCreationDeps);
    const createIntegrationOrder = new CreateIntegrationOrder(orderCreationDeps);
    const confirmOrder = new ConfirmOrder(sharedDeps);
    const acknowledgeOrder = new AcknowledgeOrder({
        ...sharedDeps,
        confirmOrder,
    });
    /** @type {import('./services/create-integration-fulfilled-order.js').CreateIntegrationFulfilledOrder|null} */
    let createIntegrationFulfilledOrder = null;
    const orderCommandService = new DefaultOrderCommandService({
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
     * @param {import('./services/create-shipment.js').CreateShipment} shipmentDeps.createShipment
     * @param {import('../shipments/services/ship-shipment.js').ShipShipment} shipmentDeps.shipShipment
     * @param {(tx: object, tenantId: string, orderId: string) => Promise<object[]>} shipmentDeps.listShipmentsForOrder
     */
    function wireChannelFulfilledOrder(shipmentDeps) {
        createIntegrationFulfilledOrder = new CreateIntegrationFulfilledOrder({
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
