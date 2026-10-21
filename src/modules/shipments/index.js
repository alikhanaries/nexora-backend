/**
 * Shipments domain: create/ship/deliver/cancel flows, tracking updates, and order-scoped listing helper.
 * Re-exports shipment entity helpers from `./models`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCreateShipment,
    createGetShipment,
    createListShipments,
    createShipShipment,
    createDeliverShipment,
    createCancelShipment,
    createUpdateShipmentTracking,
    createShipmentQueryService,
    createShipmentCommandService
} from './services/index.js';
import { toShipmentDetailDto } from './views/shipment-dto.js';
import { createPostgresShipmentRepository } from './repositories/index.js';
/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('../inventory/public/index.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../orders/public/index.js').OrderQueryService} deps.orderQueryService
 * @param {import('../orders/public/index.js').OrderFulfillmentService} deps.orderFulfillmentService
 * @param {import('../external-id-mapping/public/index.js').ExternalIntegerIdMappingCommandService} deps.externalIntegerIdMappingCommandService
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ shipmentCommandService: object, shipmentQueryService: object, listShipmentsForOrder: Function, useCases: object }}
 */
export function createShipmentsModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const shipments = createPostgresShipmentRepository();
    const shipmentQueryService = createShipmentQueryService({
        authorization,
        queryable: deps.database,
        shipments
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        shipments,
        eventRecorder: deps.eventRecorder,
        idempotency: deps.idempotency,
        inventoryService: deps.inventoryService,
        orderQueryService: deps.orderQueryService,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const createShipment = createCreateShipment({
        ...lifecycleDeps,
        orderFulfillmentService: deps.orderFulfillmentService,
        externalIntegerIdMappingCommandService: deps.externalIntegerIdMappingCommandService
    });
    const updateShipmentTracking = createUpdateShipmentTracking(lifecycleDeps);
    const shipmentCommandService = createShipmentCommandService({
        createShipment,
        updateShipmentTracking,
        idempotency: deps.idempotency
    });
    const useCases = {
        createShipment,
        listShipments: createListShipments({
            authorization,
            queryable: deps.database,
            shipments
        }),
        getShipment: createGetShipment({ authorization, shipmentQueryService }),
        shipShipment: createShipShipment(lifecycleDeps),
        updateShipmentTracking,
        deliverShipment: createDeliverShipment(lifecycleDeps),
        cancelShipment: createCancelShipment({
            ...lifecycleDeps,
            orderFulfillmentService: deps.orderFulfillmentService
        }),
        idempotency: deps.idempotency
    };
/**
     * Module export: lists shipments belonging to an order within a tenant (used by order read models).
     * @param {object} deps Wired shipment query dependencies.
     * @param {string} tenantId Tenant scope.
     * @param {string} orderId Parent order id.
     */
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
        useCases
    };
}
export {
    createShipmentEntity,
    reconstituteShipment,
    transitionShipmentEntity,
    shipShipmentEntity,
    deliverShipmentEntity,
    cancelShipmentEntity,
} from './models/shipment.js';
export { ShipmentStatus } from './models/shipment-status.js';
