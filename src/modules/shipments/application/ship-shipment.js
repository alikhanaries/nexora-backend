import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { toShipmentDetailDto } from './shipment-dto.js';
import { shipmentShippedEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { ShipmentStatus } from '../domain/shipment-status.js';
import { fulfillInventoryWhenShipmentShipped } from './fulfill-inventory-when-shipment-shipped.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';
export class ShipShipment {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (input.skipAuthorization !== true) {
            requireShipmentsUpdate(this.deps.authorization, input.actorPermissions);
        }
        const work = async (tx) => {
            const existing = await this.deps.shipments.lockShipmentForUpdate(tx, input.tenantId, input.shipmentId);
            if (existing === null) {
                throw new NotFoundError('Shipment was not found', {
                    tenantId: input.tenantId,
                    shipmentId: input.shipmentId,
                });
            }
            const previousStatus = existing.status;
            const now = new Date();
            let updated = existing.ship();
            if (input.carrier !== undefined ||
                input.service !== undefined ||
                input.trackingNumber !== undefined) {
                updated = updated.withCarrierDetails({
                    ...(input.carrier === undefined
                        ? {}
                        : { carrier: normalizeOptionalText(input.carrier) }),
                    ...(input.service === undefined
                        ? {}
                        : { service: normalizeOptionalText(input.service) }),
                    ...(input.trackingNumber === undefined
                        ? {}
                        : { trackingNumber: normalizeOptionalText(input.trackingNumber) }),
                }, now);
            }
            await this.deps.shipments.updateShipment(tx, updated);
            const lines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
            if (previousStatus !== ShipmentStatus.SHIPPED && updated.status === ShipmentStatus.SHIPPED) {
                await fulfillInventoryWhenShipmentShipped({
                    inventoryService: this.deps.inventoryService,
                    orderQueryService: this.deps.orderQueryService,
                }, tx, {
                    tenantId: input.tenantId,
                    orderId: updated.orderId,
                    shipmentId: updated.id,
                    shipmentLines: lines.map((line) => ({
                        id: line.id,
                        orderLineId: line.orderLineId,
                        quantity: line.quantity,
                    })),
                    ...(input.inventoryConsumptionMode === undefined
                        ? {}
                        : { inventoryConsumptionMode: input.inventoryConsumptionMode }),
                });
            }
            const detail = toShipmentDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, shipmentStatusChangedEvent(detail, previousStatus));
                await this.deps.eventRecorder.record(tx, shipmentShippedEvent(detail));
            }
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'SHIPMENT_SHIPPED',
                resourceType: 'shipment',
                resourceId: updated.id,
                metadata: {
                    orderId: updated.orderId,
                    previousStatus,
                    newStatus: updated.status,
                    trackingNumber: updated.trackingNumber,
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
function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
