import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
/** Reads the current request id from async context for outbound domain events. */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
/** Serializes cancellation fields needed by downstream consumers (tenant id included). */
function cancellationPayload(cancellation) {
    return {
        id: cancellation.id,
        tenantId: cancellation.tenantId,
        orderId: cancellation.orderId,
        status: cancellation.status,
        reason: cancellation.reason,
        lines: cancellation.lines.map((line) => ({
            id: line.id,
            orderLineId: line.orderLineId,
            quantity: line.quantity,
        })),
    };
}
/** Builds a versioned integration event envelope for the cancellation aggregate. */
export function cancellationCreatedEvent(cancellation) {
    return {
        type: 'cancellation.created',
        version: EVENT_VERSION,
        aggregateType: 'cancellation',
        aggregateId: cancellation.id,
        tenantId: cancellation.tenantId,
        payload: cancellationPayload(cancellation),
        correlationId: correlationId(),
    };
}
/** Builds a versioned integration event envelope for the cancellation aggregate. */
export function cancellationCompletedEvent(cancellation) {
    return {
        type: 'cancellation.completed',
        version: EVENT_VERSION,
        aggregateType: 'cancellation',
        aggregateId: cancellation.id,
        tenantId: cancellation.tenantId,
        payload: cancellationPayload(cancellation),
        correlationId: correlationId(),
    };
}
