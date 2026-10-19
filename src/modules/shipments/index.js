import { DefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCreateShipment,
    createGetShipment,
    createListShipments,
    createShipShipment,
    createDeliverShipment,
    createCancelShipment,
    createUpdateShipmentTracking,
    createShipmentQueryService,
    createShipmentCommandService,
} from './services/index.js';
import { toShipmentDetailDto } from './views/shipment-dto.js';
import { PostgresShipmentRepository } from './repositories/index.js';
import shipmentRoutes, {} from './controllers/shipment.routes.js';
export function createShipmentsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const shipments = new PostgresShipmentRepository();
    const shipmentQueryService = createShipmentQueryService({
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
    const createShipment = createCreateShipment({
        ...lifecycleDeps,
        orderFulfillmentService: deps.orderFulfillmentService,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService,
    });
    const updateShipmentTracking = createUpdateShipmentTracking(lifecycleDeps);
    const shipmentCommandService = createShipmentCommandService({
        createShipment,
        updateShipmentTracking,
        idempotency: deps.idempotency,
    });
    const useCases = {
        createShipment,
        listShipments: createListShipments({
            authorization,
            queryable: deps.database,
            shipments,
        }),
        getShipment: createGetShipment({ authorization, shipmentQueryService }),
        shipShipment: createShipShipment(lifecycleDeps),
        updateShipmentTracking,
        deliverShipment: createDeliverShipment(lifecycleDeps),
        cancelShipment: createCancelShipment({
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
