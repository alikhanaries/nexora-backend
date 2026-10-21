import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
/**
 * Reads requestId from async context for domain event correlation (outbound webhook dispatch).
 */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
/**
 * Minimal aggregate fields included on integration events (tenantId on orders, null for global marketplaces).
 */
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
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
