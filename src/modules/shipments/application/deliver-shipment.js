import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { toShipmentDetailDto } from './shipment-dto.js';
import { shipmentDeliveredEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';
export class DeliverShipment {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireShipmentsUpdate(this.deps.authorization, input.actorPermissions);
        const shipment = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.shipments.lockShipmentForUpdate(tx, input.tenantId, input.shipmentId);
            if (existing === null) {
                throw new NotFoundError('Shipment was not found', {
                    tenantId: input.tenantId,
                    shipmentId: input.shipmentId,
                });
            }
            const previousStatus = existing.status;
            const updated = existing.deliver();
            await this.deps.shipments.updateShipment(tx, updated);
            const lines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
            const detail = toShipmentDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, shipmentStatusChangedEvent(detail, previousStatus));
                await this.deps.eventRecorder.record(tx, shipmentDeliveredEvent(detail));
            }
            await this.deps.auditRecorder?.record(tx, {
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
}
