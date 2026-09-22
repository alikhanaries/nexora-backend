import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';
import { AppError, BusinessRuleError, ConflictError, NotFoundError, ValidationError, } from '../../../shared/errors/index.js';
import { ShipmentLine } from '../domain/shipment-line.js';
import { Shipment } from '../domain/shipment.js';
import { toShipmentDetailDto } from './shipment-dto.js';
import { shipmentCreatedEvent } from './shipment-events.js';
import { requireShipmentsCreate } from './shipment-permissions.js';
import { isEquivalentShipmentRequest, normalizeOptionalShipmentText, } from './shipment-request-equivalence.js';

const EXTERNAL_REFERENCE_UNIQUE_CONSTRAINT = 'shipments_tenant_external_reference_unique';

export class CreateShipment {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (input.skipAuthorization !== true) {
            requireShipmentsCreate(this.deps.authorization, input.actorPermissions);
        }
        if (input.lines.length === 0) {
            throw new ValidationError('Shipment must contain at least one line');
        }
        const work = async (tx) => {
            /** @type {Map<string, number>} */
            const requestedByLine = new Map();
            for (const line of input.lines) {
                if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                    throw new ValidationError('Line quantity must be a positive integer');
                }
                requestedByLine.set(line.orderLineId, (requestedByLine.get(line.orderLineId) ?? 0) + line.quantity);
            }
            const carrier = normalizeOptionalShipmentText(input.carrier);
            const service = normalizeOptionalShipmentText(input.service);
            const trackingNumber = normalizeOptionalShipmentText(input.trackingNumber);
            const externalReference = normalizeOptionalShipmentText(input.externalReference);

            if (externalReference !== null) {
                const existing = await this.deps.shipments.findByExternalReference(tx, input.tenantId, externalReference);
                if (existing !== null) {
                    return this.resolveExistingExternalReferenceShipment(tx, input, existing, requestedByLine, carrier, trackingNumber);
                }
            }

            const lockedLines = await this.deps.orderFulfillmentService.lockOrderLinesForFulfillment(input.tenantId, input.orderId, tx);
            const lockedById = new Map(lockedLines.map((line) => [line.id, line]));
            for (const orderLineId of requestedByLine.keys()) {
                if (!lockedById.has(orderLineId)) {
                    throw new NotFoundError('Order line was not found on this order', {
                        tenantId: input.tenantId,
                        orderId: input.orderId,
                        orderLineId,
                    });
                }
            }

            if (externalReference !== null) {
                const existing = await this.deps.shipments.lockByExternalReferenceForUpdate(tx, input.tenantId, externalReference);
                if (existing !== null) {
                    return this.resolveExistingExternalReferenceShipment(tx, input, existing, requestedByLine, carrier, trackingNumber);
                }
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
            const created = Shipment.create({
                id: shipmentId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                externalReference,
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
            try {
                await this.deps.shipments.insertShipment(tx, created);
            }
            catch (error) {
                if (externalReference !== null && isExternalReferenceUniqueViolation(error)) {
                    const raced = await this.deps.shipments.lockByExternalReferenceForUpdate(tx, input.tenantId, externalReference);
                    if (raced !== null) {
                        return this.resolveExistingExternalReferenceShipment(tx, input, raced, requestedByLine, carrier, trackingNumber);
                    }
                }
                throw error;
            }
            for (const shipmentLine of shipmentLines) {
                await this.deps.shipments.insertShipmentLine(tx, shipmentLine);
            }
            await this.deps.externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: input.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.SHIPMENT,
                resourceId: created.id,
            });
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
                    ...(externalReference === null ? {} : { externalReference }),
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

    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../domain/shipment.js').Shipment} existing
     * @param {Map<string, number>} requestedByLine
     * @param {string|null} carrier
     * @param {string|null} trackingNumber
     */
    async resolveExistingExternalReferenceShipment(tx, input, existing, requestedByLine, carrier, trackingNumber) {
        if (existing.orderId !== input.orderId) {
            throw new ConflictError('Shipment external reference belongs to a different order', {
                externalReference: existing.externalReference,
                orderId: input.orderId,
                existingOrderId: existing.orderId,
            });
        }
        const existingLines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, existing.id);
        if (isEquivalentShipmentRequest(existing, existingLines, input, requestedByLine, carrier, trackingNumber)) {
            return toShipmentDetailDto(existing, existingLines);
        }
        throw new ConflictError('Shipment external reference was reused with a different request', {
            externalReference: existing.externalReference,
        });
    }
}

/**
 * @param {unknown} error
 */
function isExternalReferenceUniqueViolation(error) {
    if (!AppError.isAppError(error) || !(error instanceof ConflictError)) {
        return false;
    }
    const details = error.safeDetails;
    if (typeof details !== 'object' || details === null) {
        return false;
    }
    return details.constraint === EXTERNAL_REFERENCE_UNIQUE_CONSTRAINT;
}
