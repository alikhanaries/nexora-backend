import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { ReturnDetailDto } from './return-dto.js';

const EVENT_VERSION = 1;

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function returnPayload(returnDetail: ReturnDetailDto): Readonly<Record<string, unknown>> {
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

export function returnCreatedEvent(returnDetail: ReturnDetailDto): NewIntegrationEvent {
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

export function returnStatusChangedEvent(
  returnDetail: ReturnDetailDto,
  previousStatus: string,
): NewIntegrationEvent {
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
