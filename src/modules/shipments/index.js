import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { CancelShipment } from './application/cancel-shipment.js';
import { CreateShipment } from './application/create-shipment.js';
import { DeliverShipment } from './application/deliver-shipment.js';
import { GetShipment } from './application/get-shipment.js';
import { ListShipments } from './application/list-shipments.js';
import { ShipShipment } from './application/ship-shipment.js';
import { DefaultShipmentQueryService } from './public/shipment-query-service.js';
import { PostgresShipmentRepository } from './infrastructure/index.js';
import shipmentRoutes, {} from './presentation/shipment.routes.js';
export function createShipmentsModule(deps) {
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
        idempotency: deps.idempotency,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const useCases = {
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
        idempotency: deps.idempotency,
    };
    return {
        shipmentQueryService,
        useCases,
        routes: shipmentRoutes,
    };
}
export { Shipment } from './domain/shipment.js';
export { ShipmentStatus } from './domain/shipment-status.js';
