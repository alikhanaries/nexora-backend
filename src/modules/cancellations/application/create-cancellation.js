import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../audit/public/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { CancellationLine } from '../domain/cancellation-line.js';
import { Cancellation } from '../domain/cancellation.js';
import { toCancellationDto, toCancellationLineDto, } from './cancellation-dto.js';
import { cancellationCompletedEvent, cancellationCreatedEvent } from './cancellation-events.js';
import { requireCancellationsCreate, requireOrdersCancel } from './cancellation-permissions.js';
const CANCELLATION_REFERENCE_TYPE = 'CANCELLATION';
const ORDER_REFERENCE_TYPE = 'ORDER';
const CANCELLATION_IDEMPOTENCY_PREFIX = 'cancellation';
export class CreateCancellation {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        if (input.permission === 'cancellations.create') {
            requireCancellationsCreate(this.deps.authorization, input.actorPermissions);
        }
        else {
            requireOrdersCancel(this.deps.authorization, input.actorPermissions);
        }
        const order = await this.deps.orders.findById(this.deps.database, input.tenantId, input.orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        const reason = input.reason === undefined || input.reason === null ? null : input.reason.trim() || null;
        const requestedLines = input.lines ?? [];
        for (const line of requestedLines) {
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                throw new ValidationError('Cancellation line quantity must be a positive integer');
            }
        }
        const cancellationId = randomUUID();
        const now = new Date();
        const detail = await this.deps.database.execute(async (tx) => {
            const cancellation = Cancellation.create({
                id: cancellationId,
                tenantId: input.tenantId,
                orderId: input.orderId,
                reason,
                createdAt: now,
            });
            await this.deps.cancellations.insertCancellation(tx, cancellation);
            const fulfillment = await this.deps.orderFulfillmentService.applyCancellation(tx, {
                tenantId: input.tenantId,
                orderId: input.orderId,
                lines: requestedLines.map((line) => ({
                    orderLineId: line.orderLineId,
                    quantity: line.quantity,
                })),
            });
            const persistedLines = [];
            for (const applied of fulfillment.appliedLines) {
                const cancellationLine = CancellationLine.create({
                    id: randomUUID(),
                    tenantId: input.tenantId,
                    cancellationId,
                    orderLineId: applied.orderLineId,
                    quantity: applied.quantity,
                    createdAt: now,
                });
                await this.deps.cancellations.insertCancellationLine(tx, cancellationLine);
                persistedLines.push(cancellationLine);
                await this.releaseInventoryForCancellation(tx, input.tenantId, input.orderId, cancellationId, applied);
            }
            const completed = cancellation.complete(now);
            await this.deps.cancellations.updateCancellation(tx, completed);
            const dto = {
                ...toCancellationDto(completed),
                lines: persistedLines.map(toCancellationLineDto),
            };
            await this.deps.eventRecorder.record(tx, cancellationCreatedEvent(dto));
            await this.deps.eventRecorder.record(tx, cancellationCompletedEvent(dto));
            await this.deps.auditRecorder?.record(tx, {
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
                },
                ...auditRequestFields(),
            });
            return dto;
        }, { tenantId: input.tenantId });
        return { cancellation: detail };
    }
    async releaseInventoryForCancellation(tx, tenantId, orderId, cancellationId, applied) {
        const releaseInput = {
            tenantId,
            stockLocationId: applied.stockLocationId,
            productId: applied.productId,
            quantity: applied.quantity,
            idempotencyKey: `${CANCELLATION_IDEMPOTENCY_PREFIX}:${cancellationId}:${applied.orderLineId}`,
        };
        try {
            await this.deps.inventoryService.release({
                ...releaseInput,
                referenceType: CANCELLATION_REFERENCE_TYPE,
                referenceId: cancellationId,
            }, tx);
        }
        catch (error) {
            if (!(error instanceof NotFoundError)) {
                throw error;
            }
            await this.deps.inventoryService.release({
                ...releaseInput,
                referenceType: ORDER_REFERENCE_TYPE,
                referenceId: orderId,
            }, tx);
        }
    }
}
