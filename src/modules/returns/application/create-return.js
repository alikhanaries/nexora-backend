import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';
import { AppError, BusinessRuleError, ConflictError, NotFoundError, ValidationError, } from '../../../shared/errors/index.js';
import { Return } from '../domain/return.js';
import { ReturnLine } from '../domain/return-line.js';
import { toReturnDetailDto } from './return-dto.js';
import { returnCreatedEvent } from './return-events.js';
import { requireReturnsCreate } from './return-permissions.js';
import { isEquivalentReturnRequest, normalizeOptionalReturnText, } from './return-request-equivalence.js';

const EXTERNAL_REFERENCE_UNIQUE_CONSTRAINT = 'returns_tenant_external_reference_unique';

export class CreateReturn {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireReturnsCreate(this.deps.authorization, input.actorPermissions);
        if (input.lines.length === 0) {
            throw new ValidationError('Return must contain at least one line');
        }
        const reason = normalizeOptionalReturnText(input.reason);
        const externalReference = normalizeOptionalReturnText(input.externalReference);
        const shipmentId = input.shipmentId === undefined || input.shipmentId === null ? null : input.shipmentId;
        /** @type {Map<string, number>} */
        const requestedByLine = new Map();
        for (const line of input.lines) {
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                throw new ValidationError('Return line quantity must be a positive integer');
            }
            requestedByLine.set(line.orderLineId, (requestedByLine.get(line.orderLineId) ?? 0) + line.quantity);
        }
        const returnId = randomUUID();
        const now = new Date();
        const work = async (tx) => {
            if (externalReference !== null) {
                const existing = await this.deps.returns.findByExternalReference(tx, input.tenantId, externalReference);
                if (existing !== null) {
                    return this.resolveExistingExternalReferenceReturn(tx, input, existing, requestedByLine, reason, shipmentId);
                }
            }
            const order = await this.deps.orders.findOrder(tx, input.tenantId, input.orderId);
            if (order === null) {
                throw new NotFoundError('Order was not found', {
                    tenantId: input.tenantId,
                    orderId: input.orderId,
                });
            }
            if (shipmentId !== null) {
                const valid = await this.deps.returns.verifyShipmentBelongsToOrder(tx, input.tenantId, input.orderId, shipmentId);
                if (!valid) {
                    throw new NotFoundError('Shipment was not found for this order', {
                        tenantId: input.tenantId,
                        orderId: input.orderId,
                        shipmentId,
                    });
                }
            }
            const orderLines = await this.deps.orders.lockOrderLinesForUpdate(tx, input.tenantId, input.orderId);
            if (externalReference !== null) {
                const existing = await this.deps.returns.lockByExternalReferenceForUpdate(tx, input.tenantId, externalReference);
                if (existing !== null) {
                    return this.resolveExistingExternalReferenceReturn(tx, input, existing, requestedByLine, reason, shipmentId);
                }
            }
            const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
            const orderLineIds = [...requestedByLine.keys()];
            const pendingByLine = await this.deps.returns.sumPendingQuantitiesByOrderLine(tx, input.tenantId, input.orderId, orderLineIds);
            const returnLines = [];
            for (const [orderLineId, quantity] of requestedByLine) {
                const orderLine = orderLineById.get(orderLineId);
                if (orderLine === undefined) {
                    throw new NotFoundError('Order line was not found on this order', {
                        orderId: input.orderId,
                        orderLineId,
                    });
                }
                const pendingQuantity = pendingByLine.get(orderLineId) ?? 0;
                const eligibleQuantity = orderLine.shippedQuantity - orderLine.returnedQuantity - pendingQuantity;
                if (quantity > eligibleQuantity) {
                    throw new BusinessRuleError('Return quantity exceeds eligible amount for order line', {
                        orderLineId,
                        requestedQuantity: quantity,
                        eligibleQuantity,
                        shippedQuantity: orderLine.shippedQuantity,
                        returnedQuantity: orderLine.returnedQuantity,
                        pendingQuantity,
                    });
                }
                const lineInput = input.lines.find((line) => line.orderLineId === orderLineId);
                const lineReason = lineInput?.reason === undefined || lineInput?.reason === null
                    ? null
                    : lineInput.reason.trim() || null;
                returnLines.push(ReturnLine.create({
                    id: randomUUID(),
                    tenantId: input.tenantId,
                    returnId,
                    orderLineId,
                    quantity,
                    reason: lineReason,
                    createdAt: now,
                }));
            }
            const returnEntity = Return.create({
                id: returnId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                externalReference,
                shipmentId,
                reason,
                createdAt: now,
            });
            try {
                await this.deps.returns.insertReturn(tx, returnEntity);
            }
            catch (error) {
                if (externalReference !== null && isExternalReferenceUniqueViolation(error)) {
                    const raced = await this.deps.returns.lockByExternalReferenceForUpdate(tx, input.tenantId, externalReference);
                    if (raced !== null) {
                        return this.resolveExistingExternalReferenceReturn(tx, input, raced, requestedByLine, reason, shipmentId);
                    }
                }
                throw error;
            }
            for (const line of returnLines) {
                await this.deps.returns.insertReturnLine(tx, line);
            }
            await this.deps.externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: input.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.RETURN,
                resourceId: returnEntity.id,
            });
            const detail = toReturnDetailDto(returnEntity, returnLines);
            await this.deps.eventRecorder.record(tx, returnCreatedEvent(detail));
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'RETURN_CREATED',
                resourceType: 'return',
                resourceId: returnEntity.id,
                metadata: {
                    orderId: returnEntity.orderId,
                    shipmentId: returnEntity.shipmentId,
                    lineCount: returnLines.length,
                    ...(externalReference === null ? {} : { externalReference }),
                },
                ...auditRequestFields(),
            });
            return detail;
        };
        const returnDetail = input.transaction !== undefined
            ? await work(input.transaction)
            : await this.deps.database.execute(work, { tenantId: input.tenantId });
        return { return: returnDetail };
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../domain/return.js').Return} existing
     * @param {Map<string, number>} requestedByLine
     * @param {string|null} reason
     * @param {string|null} shipmentId
     */
    async resolveExistingExternalReferenceReturn(tx, input, existing, requestedByLine, reason, shipmentId) {
        if (existing.orderId !== input.orderId) {
            throw new ConflictError('Return external reference belongs to a different order', {
                externalReference: existing.externalReference,
                orderId: input.orderId,
                existingOrderId: existing.orderId,
            });
        }
        const existingLines = await this.deps.returns.listReturnLines(tx, input.tenantId, existing.id);
        if (isEquivalentReturnRequest(existing, existingLines, input, requestedByLine, reason, shipmentId)) {
            return toReturnDetailDto(existing, existingLines);
        }
        throw new ConflictError('Return external reference was reused with a different request', {
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
