import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { CancellationDetailDto } from './cancellation-dto.js';

const EVENT_VERSION = 1;

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function cancellationPayload(
  cancellation: CancellationDetailDto,
): Readonly<Record<string, unknown>> {
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

export function cancellationCreatedEvent(cancellation: CancellationDetailDto): NewIntegrationEvent {
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

export function cancellationCompletedEvent(
  cancellation: CancellationDetailDto,
): NewIntegrationEvent {
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
