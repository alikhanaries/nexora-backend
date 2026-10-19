import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
function orderPayload(order) {
    return {
        orderId: order.id,
        tenantId: order.tenantId,
        channelId: order.channelId,
        orderNumber: order.orderNumber,
        status: order.status,
        currency: order.currency,
        totalMinor: order.totalMinor,
    };
}
export function orderCreatedEvent(order) {
    return {
        type: 'order.created',
        version: EVENT_VERSION,
        aggregateType: 'order',
        aggregateId: order.id,
        tenantId: order.tenantId,
        payload: orderPayload(order),
        correlationId: correlationId(),
    };
}
export function orderStatusChangedEvent(order, previousStatus) {
    return {
        type: 'order.status_changed',
        version: EVENT_VERSION,
        aggregateType: 'order',
        aggregateId: order.id,
        tenantId: order.tenantId,
        payload: {
            ...orderPayload(order),
            previousStatus,
        },
        correlationId: correlationId(),
    };
}
export function orderConfirmedEvent(order) {
    return {
        type: 'order.confirmed',
        version: EVENT_VERSION,
        aggregateType: 'order',
        aggregateId: order.id,
        tenantId: order.tenantId,
        payload: orderPayload(order),
        correlationId: correlationId(),
    };
}
export function orderCancelledEvent(order) {
    return {
        type: 'order.cancelled',
        version: EVENT_VERSION,
        aggregateType: 'order',
        aggregateId: order.id,
        tenantId: order.tenantId,
        payload: orderPayload(order),
        correlationId: correlationId(),
    };
}
