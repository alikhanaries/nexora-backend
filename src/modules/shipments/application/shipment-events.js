import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
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
