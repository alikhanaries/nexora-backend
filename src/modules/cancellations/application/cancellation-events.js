import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
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
