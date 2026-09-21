import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { PriceDto } from './price-dto.js';

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function pricePayload(price: PriceDto): Readonly<Record<string, unknown>> {
  return {
    id: price.id,
    tenantId: price.tenantId,
    productId: price.productId,
    channelId: price.channelId,
    currency: price.currency,
    amountMinor: price.amountMinor,
    validFrom: price.validFrom.toISOString(),
    validTo: price.validTo?.toISOString() ?? null,
    status: price.status,
  };
}

export function priceCreatedEvent(price: PriceDto): NewIntegrationEvent {
  return {
    type: 'price.created',
    version: 1,
    aggregateType: 'price',
    aggregateId: price.id,
    tenantId: price.tenantId,
    payload: pricePayload(price),
    correlationId: correlationId(),
  };
}

export function priceUpdatedEvent(
  price: PriceDto,
  changes: Readonly<Record<string, unknown>>,
): NewIntegrationEvent {
  return {
    type: 'price.updated',
    version: 1,
    aggregateType: 'price',
    aggregateId: price.id,
    tenantId: price.tenantId,
    payload: {
      ...pricePayload(price),
      changes,
    },
    correlationId: correlationId(),
  };
}

export function priceChangedEvent(price: PriceDto, reason: string): NewIntegrationEvent {
  return {
    type: 'price.changed',
    version: 1,
    aggregateType: 'price',
    aggregateId: price.id,
    tenantId: price.tenantId,
    payload: {
      ...pricePayload(price),
      reason,
    },
    correlationId: correlationId(),
  };
}
