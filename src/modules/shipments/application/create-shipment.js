import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { ShipmentLine } from '../domain/shipment-line.js';
import { Shipment } from '../domain/shipment.js';
import { toShipmentDetailDto } from './shipment-dto.js';
import { shipmentCreatedEvent } from './shipment-events.js';
import { requireShipmentsCreate } from './shipment-permissions.js';
export class CreateShipment {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireShipmentsCreate(this.deps.authorization, input.actorPermissions);
        if (input.lines.length === 0) {
            throw new ValidationError('Shipment must contain at least one line');
        }
        const shipment = await this.deps.database.execute(async (tx) => {
            const lockedLines = await this.deps.orderFulfillmentService.lockOrderLinesForFulfillment(input.tenantId, input.orderId, tx);
            const lockedById = new Map(lockedLines.map((line) => [line.id, line]));
            const requestedByLine = new Map();
            for (const line of input.lines) {
                if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                    throw new ValidationError('Line quantity must be a positive integer');
                }
                if (!lockedById.has(line.orderLineId)) {
                    throw new NotFoundError('Order line was not found on this order', {
                        tenantId: input.tenantId,
                        orderId: input.orderId,
                        orderLineId: line.orderLineId,
                    });
                }
                requestedByLine.set(line.orderLineId, (requestedByLine.get(line.orderLineId) ?? 0) + line.quantity);
            }
            for (const [orderLineId, quantity] of requestedByLine) {
                const orderLine = lockedById.get(orderLineId);
                if (quantity > orderLine.shippableQuantity()) {
                    throw new BusinessRuleError('Shipment quantity exceeds shippable quantity', {
                        orderLineId,
                        requestedQuantity: quantity,
                        shippableQuantity: orderLine.shippableQuantity(),
                    });
                }
            }
            const shipmentId = randomUUID();
            const now = new Date();
            const carrier = normalizeOptionalText(input.carrier);
            const service = normalizeOptionalText(input.service);
            const trackingNumber = normalizeOptionalText(input.trackingNumber);
            const created = Shipment.create({
                id: shipmentId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                carrier,
                service,
                trackingNumber,
                createdAt: now,
            });
            const shipmentLines = [];
            for (const line of input.lines) {
                const shipmentLine = ShipmentLine.create({
                    id: randomUUID(),
                    tenantId: input.tenantId,
                    shipmentId,
                    orderLineId: line.orderLineId,
                    quantity: line.quantity,
                    createdAt: now,
                });
                shipmentLines.push(shipmentLine);
            }
            await this.deps.shipments.insertShipment(tx, created);
            for (const shipmentLine of shipmentLines) {
                await this.deps.shipments.insertShipmentLine(tx, shipmentLine);
            }
            await this.deps.orderFulfillmentService.applyShipmentQuantities(input.tenantId, input.orderId, [...requestedByLine.entries()].map(([orderLineId, quantity]) => ({
                orderLineId,
                quantity,
            })), tx);
            await this.deps.orderFulfillmentService.evaluateOrderShipmentState(input.tenantId, input.orderId, tx);
            const detail = toShipmentDetailDto(created, shipmentLines);
            await this.deps.eventRecorder.record(tx, shipmentCreatedEvent(detail));
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'SHIPMENT_CREATED',
                resourceType: 'shipment',
                resourceId: created.id,
                metadata: {
                    orderId: created.orderId,
                    lineCount: shipmentLines.length,
                    status: created.status,
                },
                ...auditRequestFields(),
            });
            return detail;
        }, { tenantId: input.tenantId });
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
