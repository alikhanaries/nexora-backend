import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { deliverShipmentEntity } from '../models/shipment.js';
import { toShipmentDetailDto } from '../views/shipment-dto.js';
import { shipmentDeliveredEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createDeliverShipment(deps) {
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
            const previousStatus = existing.status;
            const updated = deliverShipmentEntity(existing);
            await deps.shipments.updateShipment(tx, updated);
            const lines = await deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
            const detail = toShipmentDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await deps.eventRecorder.record(tx, shipmentStatusChangedEvent(detail, previousStatus));
                await deps.eventRecorder.record(tx, shipmentDeliveredEvent(detail));
            }
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'SHIPMENT_DELIVERED',
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
