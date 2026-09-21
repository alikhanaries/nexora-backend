import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { OrderDto } from './order-dto.js';

const EVENT_VERSION = 1;

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function orderPayload(order: OrderDto): Readonly<Record<string, unknown>> {
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

export function orderCreatedEvent(order: OrderDto): NewIntegrationEvent {
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

export function orderStatusChangedEvent(
  order: OrderDto,
  previousStatus: string,
): NewIntegrationEvent {
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

export function orderConfirmedEvent(order: OrderDto): NewIntegrationEvent {
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

export function orderCancelledEvent(order: OrderDto): NewIntegrationEvent {
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
