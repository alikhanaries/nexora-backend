import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { OrderFulfillmentService } from '../orders/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import { CancelShipment } from './application/cancel-shipment.js';
import { CreateShipment } from './application/create-shipment.js';
import { DeliverShipment } from './application/deliver-shipment.js';
import { GetShipment } from './application/get-shipment.js';
import { ListShipments } from './application/list-shipments.js';
import { ShipShipment } from './application/ship-shipment.js';
import { DefaultShipmentQueryService } from './public/shipment-query-service.js';
import { PostgresShipmentRepository } from './infrastructure/index.js';
import shipmentRoutes, { type ShipmentRoutesDependencies } from './presentation/shipment.routes.js';
import type { ShipmentQueryService } from './public/index.js';

export interface ShipmentsModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly orderFulfillmentService: OrderFulfillmentService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export interface ShipmentsModule {
  readonly shipmentQueryService: ShipmentQueryService;
  readonly useCases: ShipmentRoutesDependencies;
  readonly routes: typeof shipmentRoutes;
}

export function createShipmentsModule(deps: ShipmentsModuleDependencies): ShipmentsModule {
  const authorization = new DefaultAuthorizationService();
  const shipments = new PostgresShipmentRepository();

  const shipmentQueryService = new DefaultShipmentQueryService({
    queryable: deps.database,
    shipments,
  });

  const lifecycleDeps = {
    authorization,
    database: deps.database,
    shipments,
    eventRecorder: deps.eventRecorder,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  };

  const useCases: ShipmentRoutesDependencies = {
    createShipment: new CreateShipment({
      ...lifecycleDeps,
      orderFulfillmentService: deps.orderFulfillmentService,
    }),
    listShipments: new ListShipments({
      authorization,
      queryable: deps.database,
      shipments,
    }),
    getShipment: new GetShipment({ authorization, shipmentQueryService }),
    shipShipment: new ShipShipment(lifecycleDeps),
    deliverShipment: new DeliverShipment(lifecycleDeps),
    cancelShipment: new CancelShipment({
      ...lifecycleDeps,
      orderFulfillmentService: deps.orderFulfillmentService,
    }),
  };

  return {
    shipmentQueryService,
    useCases,
    routes: shipmentRoutes,
  };
}

export { Shipment } from './domain/shipment.js';
export { ShipmentStatus } from './domain/shipment-status.js';
export type { ShipmentQueryService } from './public/index.js';
