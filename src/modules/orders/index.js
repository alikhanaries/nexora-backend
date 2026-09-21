import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ConfirmOrder } from './application/confirm-order.js';
import { CreateOrder } from './application/create-order.js';
import { GetOrder } from './application/get-order.js';
import { ListOrders } from './application/list-orders.js';
import { DefaultOrderFulfillmentService } from './application/order-fulfillment-service.js';
import { DefaultOrderQueryService } from './application/order-query-service.js';
import { DefaultOrderReturnGateway } from './application/order-return-gateway.js';
import { PostgresOrderRepository } from './infrastructure/index.js';
import orderRoutes, {} from './presentation/order.routes.js';
export function createOrdersModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const orders = new PostgresOrderRepository();
    const orderFulfillmentService = new DefaultOrderFulfillmentService({
        orders,
        eventRecorder: deps.eventRecorder,
    });
    const orderQueryService = new DefaultOrderQueryService({
        queryable: deps.database,
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
    const createOrder = new CreateOrder({
        ...sharedDeps,
        productQueryService: deps.productQueryService,
        channelQueryService: deps.channelQueryService,
        offerQueryService: deps.offerQueryService,
        pricingService: deps.pricingService,
        inventoryService: deps.inventoryService,
    });
    const useCases = {
        createOrder,
        confirmOrder: new ConfirmOrder(sharedDeps),
        getOrder: new GetOrder({
            authorization,
            queryable: deps.database,
            orders,
        }),
        listOrders: new ListOrders({
            authorization,
            queryable: deps.database,
            orders,
        }),
        idempotency: deps.idempotency,
    };
    return {
        orderFulfillmentService,
        orderQueryService,
        orderReturnGateway,
        createOrder,
        useCases,
        routes: orderRoutes,
    };
}
