import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
/** Reads the current request id from async context for outbound domain events. */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
/** Serializes shipment fields needed by downstream consumers (tenant id included). */
function shipmentPayload(shipment) {
    return {
        shipmentId: shipment.id,
        tenantId: shipment.tenantId,
        orderId: shipment.orderId,
        status: shipment.status,
        carrier: shipment.carrier,
        service: shipment.service,
        trackingNumber: shipment.trackingNumber,
    };
}
/** Builds a versioned integration event envelope for the shipment aggregate. */
export function shipmentCreatedEvent(shipment) {
    return {
        type: 'shipment.created',
        version: EVENT_VERSION,
        aggregateType: 'shipment',
        aggregateId: shipment.id,
        tenantId: shipment.tenantId,
        payload: shipmentPayload(shipment),
        correlationId: correlationId(),
    };
}
/** Builds a versioned integration event envelope for the shipment aggregate. */
export function shipmentStatusChangedEvent(shipment, previousStatus) {
    return {
        type: 'shipment.status_changed',
        version: EVENT_VERSION,
        aggregateType: 'shipment',
        aggregateId: shipment.id,
        tenantId: shipment.tenantId,
        payload: {
            ...shipmentPayload(shipment),
            previousStatus,
        },
        correlationId: correlationId(),
    };
}
/** Builds a versioned integration event envelope for the shipment aggregate. */
export function shipmentShippedEvent(shipment) {
    return {
        type: 'shipment.shipped',
        version: EVENT_VERSION,
        aggregateType: 'shipment',
        aggregateId: shipment.id,
        tenantId: shipment.tenantId,
        payload: shipmentPayload(shipment),
        correlationId: correlationId(),
    };
}
/** Builds a versioned integration event envelope for the shipment aggregate. */
export function shipmentDeliveredEvent(shipment) {
    return {
        type: 'shipment.delivered',
        version: EVENT_VERSION,
        aggregateType: 'shipment',
        aggregateId: shipment.id,
        tenantId: shipment.tenantId,
        payload: shipmentPayload(shipment),
        correlationId: correlationId(),
    };
}
/** Builds a versioned integration event envelope for the shipment aggregate. */
export function shipmentCancelledEvent(shipment) {
    return {
        type: 'shipment.cancelled',
        version: EVENT_VERSION,
        aggregateType: 'shipment',
        aggregateId: shipment.id,
        tenantId: shipment.tenantId,
        payload: shipmentPayload(shipment),
        correlationId: correlationId(),
    };
}
