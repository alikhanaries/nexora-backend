import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { ShipmentDto } from './shipment-dto.js';

const EVENT_VERSION = 1;

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function shipmentPayload(shipment: ShipmentDto): Readonly<Record<string, unknown>> {
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

export function shipmentCreatedEvent(shipment: ShipmentDto): NewIntegrationEvent {
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

export function shipmentStatusChangedEvent(
  shipment: ShipmentDto,
  previousStatus: string,
): NewIntegrationEvent {
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

export function shipmentShippedEvent(shipment: ShipmentDto): NewIntegrationEvent {
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

export function shipmentDeliveredEvent(shipment: ShipmentDto): NewIntegrationEvent {
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

export function shipmentCancelledEvent(shipment: ShipmentDto): NewIntegrationEvent {
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
