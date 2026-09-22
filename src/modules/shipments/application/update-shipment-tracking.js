import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { ShipmentStatus } from '../domain/shipment-status.js';
import { toShipmentDetailDto } from './shipment-dto.js';
import { shipmentShippedEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

export class UpdateShipmentTracking {
    deps;

    constructor(deps) {
        this.deps = deps;
    }

    async execute(input) {
        requireShipmentsUpdate(this.deps.authorization, input.actorPermissions);
        const work = async (tx) => {
            const existing = await this.deps.shipments.findByExternalReference(
                tx,
                input.tenantId,
                input.externalReference,
            );
            if (existing === null) {
                throw new NotFoundError('Shipment was not found', {
                    tenantId: input.tenantId,
                    externalReference: input.externalReference,
                });
            }
            const locked = await this.deps.shipments.lockShipmentForUpdate(tx, input.tenantId, existing.id);
            if (locked === null) {
                throw new NotFoundError('Shipment was not found', {
                    tenantId: input.tenantId,
                    shipmentId: existing.id,
                });
            }
            const carrier = normalizeOptionalText(input.carrier);
            const trackingNumber = normalizeOptionalText(input.trackingNumber);
            const now = new Date();
            const previousStatus = locked.status;
            let updated = locked;

            if (locked.status === ShipmentStatus.CREATED || locked.status === ShipmentStatus.READY_TO_SHIP) {
                updated = locked.ship(now).withCarrierDetails({
                    carrier,
                    trackingNumber,
                }, now);
            }
            else if (locked.status === ShipmentStatus.SHIPPED || locked.status === ShipmentStatus.IN_TRANSIT) {
                updated = locked.withCarrierDetails({
                    carrier,
                    trackingNumber,
                }, now);
            }
            else {
                throw new BusinessRuleError('Shipment tracking cannot be updated in its current status', {
                    shipmentId: locked.id,
                    status: locked.status,
                });
            }

            await this.deps.shipments.updateShipment(tx, updated);
            const lines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
            const detail = toShipmentDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, shipmentStatusChangedEvent(detail, previousStatus));
                await this.deps.eventRecorder.record(tx, shipmentShippedEvent(detail));
            }
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: previousStatus === updated.status ? 'SHIPMENT_TRACKING_UPDATED' : 'SHIPMENT_SHIPPED',
                resourceType: 'shipment',
                resourceId: updated.id,
                metadata: {
                    orderId: updated.orderId,
                    previousStatus,
                    newStatus: updated.status,
                    trackingNumber: updated.trackingNumber,
                    externalReference: updated.externalReference,
                },
                ...auditRequestFields(),
            });
            return detail;
        };
        const shipment = input.transaction !== undefined
            ? await work(input.transaction)
            : await this.deps.database.execute(work, { tenantId: input.tenantId });
        return { shipment };
    }
}

/**
 * @param {string|null|undefined} value
 */
function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
