import type { AuditRecorder } from '../audit/public/index.js';
import type { ChannelQueryService } from '../channels/public/index.js';
import type { InventoryService } from '../inventory/public/index.js';
import type { OfferQueryService } from '../offers/public/index.js';
import type { PricingService } from '../pricing/public/index.js';
import type { ProductQueryService } from '../products/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { IdempotencyService } from '../../shared/idempotency/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import { ConfirmOrder } from './application/confirm-order.js';
import { CreateOrder } from './application/create-order.js';
import { GetOrder } from './application/get-order.js';
import { ListOrders } from './application/list-orders.js';
import { DefaultOrderFulfillmentService } from './application/order-fulfillment-service.js';
import { DefaultOrderQueryService } from './application/order-query-service.js';
import { PostgresOrderRepository } from './infrastructure/index.js';
import orderRoutes, { type OrderRoutesDependencies } from './presentation/order.routes.js';
import type { OrderFulfillmentService, OrderQueryService } from './public/index.js';

export interface OrdersModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly productQueryService: ProductQueryService;
  readonly channelQueryService: ChannelQueryService;
  readonly offerQueryService: OfferQueryService;
  readonly pricingService: PricingService;
  readonly inventoryService: InventoryService;
  readonly eventRecorder: EventRecorder;
  readonly idempotency: IdempotencyService;
  readonly auditRecorder?: AuditRecorder;
}

export interface OrdersModule {
  readonly orderFulfillmentService: OrderFulfillmentService;
  readonly orderQueryService: OrderQueryService;
  readonly createOrder: CreateOrder;
  readonly orders: PostgresOrderRepository;
  readonly useCases: OrderRoutesDependencies;
  readonly routes: typeof orderRoutes;
}

export function createOrdersModule(deps: OrdersModuleDependencies): OrdersModule {
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

  const useCases: OrderRoutesDependencies = {
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
    createOrder,
    orders,
    useCases,
    routes: orderRoutes,
  };
}

export type { OrderFulfillmentService, OrderQueryService } from './public/index.js';
