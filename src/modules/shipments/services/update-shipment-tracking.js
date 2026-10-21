import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { shipShipmentEntity, withShipmentCarrierDetails } from '../models/shipment.js';
import { ShipmentStatus } from '../models/shipment-status.js';
import { toShipmentDetailDto } from '../views/shipment-dto.js';
import { shipmentShippedEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { fulfillInventoryWhenShipmentShipped } from './fulfill-inventory-when-shipment-shipped.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createUpdateShipmentTracking(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        requireShipmentsUpdate(deps.authorization, input.actorPermissions);
/** Transactional unit of work executed inside idempotency/database `execute`. */
        const work = async (tx) => {
            const existing = await deps.shipments.findByExternalReference(
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
            const locked = await deps.shipments.lockShipmentForUpdate(tx, input.tenantId, existing.id);
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
                updated = withShipmentCarrierDetails(shipShipmentEntity(locked, now), {
                    carrier,
                    trackingNumber,
                }, now);
            }
            else if (locked.status === ShipmentStatus.SHIPPED || locked.status === ShipmentStatus.IN_TRANSIT) {
                updated = withShipmentCarrierDetails(locked, {
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

            await deps.shipments.updateShipment(tx, updated);
            const lines = await deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
            if (previousStatus !== ShipmentStatus.SHIPPED && updated.status === ShipmentStatus.SHIPPED) {
                await fulfillInventoryWhenShipmentShipped({
                    inventoryService: deps.inventoryService,
                    orderQueryService: deps.orderQueryService,
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
                await deps.eventRecorder.record(tx, shipmentStatusChangedEvent(detail, previousStatus));
                await deps.eventRecorder.record(tx, shipmentShippedEvent(detail));
            }
            await deps.auditRecorder?.record(tx, {
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
            : await deps.database.execute(work, { tenantId: input.tenantId });
        return { shipment };
    }

    return { execute };
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
