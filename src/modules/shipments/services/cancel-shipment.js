import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { cancelShipmentEntity } from '../models/shipment.js';
import { toShipmentDetailDto } from '../views/shipment-dto.js';
import { shipmentCancelledEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCancelShipment(deps) {
    async function execute(input) {
        requireShipmentsUpdate(deps.authorization, input.actorPermissions);
        const shipment = await deps.database.execute(async (tx) => {
            const existing = await deps.shipments.lockShipmentForUpdate(tx, input.tenantId, input.shipmentId);
            if (existing === null) {
                throw new NotFoundError('Shipment was not found', {
                    tenantId: input.tenantId,
                    shipmentId: input.shipmentId,
                });
            }
            const lines = await deps.shipments.listShipmentLines(tx, input.tenantId, existing.id);
            const previousStatus = existing.status;
            const updated = cancelShipmentEntity(existing);
            await deps.shipments.updateShipment(tx, updated);
            await deps.orderFulfillmentService.reverseShipmentQuantities(input.tenantId, existing.orderId, lines.map((line) => ({
                orderLineId: line.orderLineId,
                quantity: line.quantity,
            })), tx);
            await deps.orderFulfillmentService.evaluateOrderShipmentState(input.tenantId, existing.orderId, tx);
            const detail = toShipmentDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await deps.eventRecorder.record(tx, shipmentStatusChangedEvent(detail, previousStatus));
                await deps.eventRecorder.record(tx, shipmentCancelledEvent(detail));
            }
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'SHIPMENT_CANCELLED',
                resourceType: 'shipment',
                resourceId: updated.id,
                metadata: {
                    orderId: updated.orderId,
                    previousStatus,
                    newStatus: updated.status,
                },
                ...auditRequestFields(),
            });
            return detail;
        }, { tenantId: input.tenantId });
        return { shipment };
    }

    return { execute };
}
