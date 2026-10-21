import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
/** Reads the current request id from async context for outbound domain events. */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
/** Serializes return fields needed by downstream consumers (tenant id included). */
function returnPayload(returnDetail) {
    return {
        id: returnDetail.id,
        tenantId: returnDetail.tenantId,
        orderId: returnDetail.orderId,
        shipmentId: returnDetail.shipmentId,
        status: returnDetail.status,
        reason: returnDetail.reason,
        lines: returnDetail.lines.map((line) => ({
            id: line.id,
            orderLineId: line.orderLineId,
            quantity: line.quantity,
            reason: line.reason,
        })),
    };
}
/** Builds a versioned integration event envelope for the return aggregate. */
export function returnCreatedEvent(returnDetail) {
    return {
        type: 'return.created',
        version: EVENT_VERSION,
        aggregateType: 'return',
        aggregateId: returnDetail.id,
        tenantId: returnDetail.tenantId,
        payload: returnPayload(returnDetail),
        correlationId: correlationId(),
    };
}
/** Builds a versioned integration event envelope for the return aggregate. */
export function returnStatusChangedEvent(returnDetail, previousStatus) {
    return {
        type: 'return.status_changed',
        version: EVENT_VERSION,
        aggregateType: 'return',
        aggregateId: returnDetail.id,
        tenantId: returnDetail.tenantId,
        payload: {
            ...returnPayload(returnDetail),
            previousStatus,
        },
        correlationId: correlationId(),
    };
}
