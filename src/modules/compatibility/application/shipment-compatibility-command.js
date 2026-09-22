import { NotFoundError } from '../../../shared/errors/index.js';
import {
    fingerprintShipmentCommand,
    fingerprintUpdateShipmentTrackingCommand,
    mapExternalShipmentLinesToOrderLines,
    mapExternalShipmentRequest,
    mapExternalShipmentTrackingRequest,
    mapShipmentResultToExternalResponse,
    mapShipmentTrackingResultToExternalResponse,
} from './mappers/compatibility-shipment.mapper.js';

const CREATE_SHIPMENT_ROUTE_ID = 'POST /api/v2/shipments';
const UPDATE_SHIPMENT_TRACKING_ROUTE_ID = 'PUT /api/v2/shipments/:merchantShipmentNo';

export class ShipmentCompatibilityCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
     * @param {import('../../shipments/public/shipment-command-service.js').DefaultShipmentCommandService} deps.shipmentCommandService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {object} input.body
     * @param {string} input.idempotencyKey
     * @param {string} input.principalFingerprint
     */
    async createShipment(input) {
        const mapped = mapExternalShipmentRequest(input.body);
        const order = await this.deps.orderQueryService.findOrderByOrderNumber(input.tenantId, mapped.orderNumber);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderNumber: mapped.orderNumber,
            });
        }
        const orderLines = await this.deps.orderQueryService.getOrderLines(input.tenantId, order.id);
        const lines = mapExternalShipmentLinesToOrderLines(mapped.externalLines, orderLines);
        const commandInput = {
            orderNumber: mapped.orderNumber,
            merchantShipmentNo: mapped.merchantShipmentNo,
            lines,
            carrier: mapped.carrier,
            trackingNumber: mapped.trackingNumber,
        };
        const { shipment } = await this.deps.shipmentCommandService.createShipment({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            orderId: order.id,
            lines,
            carrier: mapped.carrier,
            trackingNumber: mapped.trackingNumber,
            externalReference: mapped.merchantShipmentNo,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintShipmentCommand(commandInput),
            routeId: CREATE_SHIPMENT_ROUTE_ID,
        });
        return mapShipmentResultToExternalResponse({ shipment });
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {string} input.merchantShipmentNo
     * @param {object} input.body
     * @param {string} input.idempotencyKey
     * @param {string} input.principalFingerprint
     */
    async updateShipmentTracking(input) {
        const merchantShipmentNo = input.merchantShipmentNo.trim();
        const tracking = mapExternalShipmentTrackingRequest(input.body);
        const commandInput = {
            merchantShipmentNo,
            carrier: tracking.carrier,
            trackingNumber: tracking.trackingNumber,
        };
        const { shipment } = await this.deps.shipmentCommandService.updateShipmentTracking({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorKind: input.actorKind,
            actorPermissions: input.actorPermissions,
            externalReference: merchantShipmentNo,
            carrier: tracking.carrier,
            trackingNumber: tracking.trackingNumber,
            idempotencyKey: input.idempotencyKey,
            principalFingerprint: input.principalFingerprint,
            requestFingerprint: fingerprintUpdateShipmentTrackingCommand(commandInput),
            routeId: UPDATE_SHIPMENT_TRACKING_ROUTE_ID,
        });
        return mapShipmentTrackingResultToExternalResponse({ shipment });
    }
}
