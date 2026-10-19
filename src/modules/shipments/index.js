import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { CancelShipment } from './services/cancel-shipment.js';
import { CreateShipment } from './services/create-shipment.js';
import { DeliverShipment } from './services/deliver-shipment.js';
import { GetShipment } from './services/get-shipment.js';
import { ListShipments } from './services/list-shipments.js';
import { ShipShipment } from './services/ship-shipment.js';
import { toShipmentDetailDto } from './views/shipment-dto.js';
import { UpdateShipmentTracking } from './services/update-shipment-tracking.js';
import { DefaultShipmentCommandService } from './public/shipment-command-service.js';
import { DefaultShipmentQueryService } from './public/shipment-query-service.js';
import { PostgresShipmentRepository } from './repositories/index.js';
import shipmentRoutes, {} from './controllers/shipment.routes.js';
export function createShipmentsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const shipments = new PostgresShipmentRepository();
    const shipmentQueryService = new DefaultShipmentQueryService({
        authorization,
        queryable: deps.database,
        shipments,
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        shipments,
        eventRecorder: deps.eventRecorder,
        idempotency: deps.idempotency,
        inventoryService: deps.inventoryService,
        orderQueryService: deps.orderQueryService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const createShipment = new CreateShipment({
        ...lifecycleDeps,
        orderFulfillmentService: deps.orderFulfillmentService,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
    });
    const updateShipmentTracking = new UpdateShipmentTracking(lifecycleDeps);
    const shipmentCommandService = new DefaultShipmentCommandService({
        createShipment,
        updateShipmentTracking,
        idempotency: deps.idempotency,
    });
    const useCases = {
        createShipment,
        listShipments: new ListShipments({
            authorization,
            queryable: deps.database,
            shipments,
        }),
        getShipment: new GetShipment({ authorization, shipmentQueryService }),
        shipShipment: new ShipShipment(lifecycleDeps),
        updateShipmentTracking,
        deliverShipment: new DeliverShipment(lifecycleDeps),
        cancelShipment: new CancelShipment({
            ...lifecycleDeps,
            orderFulfillmentService: deps.orderFulfillmentService,
        }),
        idempotency: deps.idempotency,
    };
    async function listShipmentsForOrder(tx, tenantId, orderId) {
        const result = await shipments.listPage(tx, tenantId, { orderId }, 100, null, null);
        return Promise.all(result.items.map(async (shipment) => {
            const lines = await shipments.listShipmentLines(tx, tenantId, shipment.id);
            return toShipmentDetailDto(shipment, lines);
        }));
    }
    return {
        shipmentCommandService,
        shipmentQueryService,
        listShipmentsForOrder,
        useCases,
        routes: shipmentRoutes,
    };
}
export { Shipment } from './models/shipment.js';
export { ShipmentStatus } from './models/shipment-status.js';
