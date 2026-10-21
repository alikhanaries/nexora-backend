import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';
import { AppError, ConflictError, NotFoundError, ValidationError, } from '../../../shared/errors/index.js';
import { createCancellationLineEntity } from '../models/cancellation-line.js';
import { completeCancellationEntity, createCancellationEntity } from '../models/cancellation.js';
import { toCancellationDto, toCancellationLineDto, } from '../views/cancellation-dto.js';
import { cancellationCompletedEvent, cancellationCreatedEvent } from './cancellation-events.js';
import { requireCancellationsCreate, requireOrdersCancel } from './cancellation-permissions.js';
import { isEquivalentCancellationRequest, normalizeOptionalCancellationText, } from './cancellation-request-equivalence.js';

const CANCELLATION_REFERENCE_TYPE = 'CANCELLATION';
const ORDER_REFERENCE_TYPE = 'ORDER';
const CANCELLATION_IDEMPOTENCY_PREFIX = 'cancellation';
const EXTERNAL_REFERENCE_UNIQUE_CONSTRAINT = 'cancellations_tenant_external_reference_unique';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCreateCancellation(deps) {
    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../models/cancellation.js').Cancellation} existing
     * @param {Map<string, number>} requestedByLine
     * @param {string|null} reason
     */
    async function resolveExistingExternalReferenceCancellation(tx, input, existing, requestedByLine, reason) {
        if (existing.orderId !== input.orderId) {
            throw new ConflictError('Cancellation external reference belongs to a different order', {
                externalReference: existing.externalReference,
                orderId: input.orderId,
                existingOrderId: existing.orderId,
            });
        }
        const existingLines = await deps.cancellations.listLines(tx, input.tenantId, existing.id);
        if (isEquivalentCancellationRequest(existing, existingLines, input, requestedByLine, reason)) {
            return {
                ...toCancellationDto(existing),
                lines: existingLines.map(toCancellationLineDto),
            };
        }
        throw new ConflictError('Cancellation external reference was reused with a different request', {
            externalReference: existing.externalReference,
        });
    }

    async function releaseInventoryForCancellation(tx, tenantId, orderId, cancellationId, applied) {
        const releaseInput = {
            tenantId,
            stockLocationId: applied.stockLocationId,
            productId: applied.productId,
            quantity: applied.quantity,
            idempotencyKey: `${CANCELLATION_IDEMPOTENCY_PREFIX}:${cancellationId}:${applied.orderLineId}`,
        };
        try {
            await deps.inventoryService.release({
                ...releaseInput,
                referenceType: CANCELLATION_REFERENCE_TYPE,
                referenceId: cancellationId,
            }, tx);
        }
        catch (error) {
            if (!(error instanceof NotFoundError)) {
                throw error;
            }
            await deps.inventoryService.release({
                ...releaseInput,
                referenceType: ORDER_REFERENCE_TYPE,
                referenceId: orderId,
            }, tx);
        }
    }

    async function execute(input) {
        if (input.permission === 'cancellations.create') {
            requireCancellationsCreate(deps.authorization, input.actorPermissions);
        }
        else {
            requireOrdersCancel(deps.authorization, input.actorPermissions);
        }
        const order = await deps.orderQueryService.findOrderById(input.tenantId, input.orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        const reason = normalizeOptionalCancellationText(input.reason);
        const externalReference = normalizeOptionalCancellationText(input.externalReference);
        const requestedLines = input.lines ?? [];
        /** @type {Map<string, number>} */
        const requestedByLine = new Map();
        for (const line of requestedLines) {
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                throw new ValidationError('Cancellation line quantity must be a positive integer');
            }
            requestedByLine.set(line.orderLineId, (requestedByLine.get(line.orderLineId) ?? 0) + line.quantity);
        }
        const cancellationId = randomUUID();
        const now = new Date();
        const work = async (tx) => {
            if (externalReference !== null) {
                const existing = await deps.cancellations.findByExternalReference(tx, input.tenantId, externalReference);
                if (existing !== null) {
                    return resolveExistingExternalReferenceCancellation(tx, input, existing, requestedByLine, reason);
                }
            }

            await deps.orderFulfillmentService.lockOrderLinesForFulfillment(input.tenantId, input.orderId, tx);

            if (externalReference !== null) {
                const existing = await deps.cancellations.lockByExternalReferenceForUpdate(tx, input.tenantId, externalReference);
                if (existing !== null) {
                    return resolveExistingExternalReferenceCancellation(tx, input, existing, requestedByLine, reason);
                }
            }

            const cancellation = createCancellationEntity({
                id: cancellationId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                externalReference,
                reason,
                createdAt: now,
            });
            try {
                await deps.cancellations.insertCancellation(tx, cancellation);
            }
            catch (error) {
                if (externalReference !== null && isExternalReferenceUniqueViolation(error)) {
                    const raced = await deps.cancellations.lockByExternalReferenceForUpdate(tx, input.tenantId, externalReference);
                    if (raced !== null) {
                        return resolveExistingExternalReferenceCancellation(tx, input, raced, requestedByLine, reason);
                    }
                }
                throw error;
            }
            const fulfillment = await deps.orderFulfillmentService.applyCancellation(tx, {
                tenantId: input.tenantId,
                orderId: input.orderId,
                lines: requestedLines.map((line) => ({
                    orderLineId: line.orderLineId,
                    quantity: line.quantity,
                })),
            });
            const persistedLines = [];
            for (const applied of fulfillment.appliedLines) {
                const cancellationLine = createCancellationLineEntity({
                    id: randomUUID(),
                    tenantId: input.tenantId,
                    cancellationId,
                    orderLineId: applied.orderLineId,
                    quantity: applied.quantity,
                    createdAt: now,
                });
                await deps.cancellations.insertCancellationLine(tx, cancellationLine);
                persistedLines.push(cancellationLine);
                await releaseInventoryForCancellation(tx, input.tenantId, input.orderId, cancellationId, applied);
            }
            const completed = completeCancellationEntity(cancellation, now);
            await deps.cancellations.updateCancellation(tx, completed);
            await deps.externalIntegerIdMappingCommandService.assignMapping(tx, {
                tenantId: input.tenantId,
                provider: ExternalIdMappingProvider.COMPAT_V2,
                resourceType: ExternalIdMappingResourceType.CANCELLATION,
                resourceId: cancellationId,
            });
            const dto = {
                ...toCancellationDto(completed),
                lines: persistedLines.map(toCancellationLineDto),
            };
            await deps.eventRecorder.record(tx, cancellationCreatedEvent(dto));
            await deps.eventRecorder.record(tx, cancellationCompletedEvent(dto));
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'CANCELLATION_CREATED',
                resourceType: 'cancellation',
                resourceId: cancellationId,
                metadata: {
                    orderId: input.orderId,
                    lineCount: persistedLines.length,
                    orderStatus: fulfillment.order.status,
                    inventoryReferenceType: CANCELLATION_REFERENCE_TYPE,
                    inventoryReferenceId: cancellationId,
                    ...(externalReference === null ? {} : { externalReference }),
                },
                ...auditRequestFields(),
            });
            return dto;
        };
        const detail = input.transaction !== undefined
            ? await work(input.transaction)
            : await deps.database.execute(work, { tenantId: input.tenantId });
        return { cancellation: detail };
    }

    return { execute };
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
