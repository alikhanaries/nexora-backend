import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { ProductDto } from './product-dto.js';

const EVENT_VERSION = 1;

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

export function productCreatedEvent(product: ProductDto): NewIntegrationEvent {
  return {
    type: 'product.created',
    version: EVENT_VERSION,
    aggregateType: 'product',
    aggregateId: product.id,
    tenantId: product.tenantId,
    payload: {
      productId: product.id,
      merchantSku: product.merchantSku,
      productType: product.productType,
      status: product.status,
    },
    correlationId: correlationId(),
  };
}

export function productUpdatedEvent(
  product: ProductDto,
  changes: Readonly<Record<string, unknown>>,
): NewIntegrationEvent {
  return {
    type: 'product.updated',
    version: EVENT_VERSION,
    aggregateType: 'product',
    aggregateId: product.id,
    tenantId: product.tenantId,
    payload: {
      productId: product.id,
      changes,
    },
    correlationId: correlationId(),
  };
}

export function productStatusChangedEvent(
  product: ProductDto,
  previousStatus: string,
): NewIntegrationEvent {
  return {
    type: 'product.status_changed',
    version: EVENT_VERSION,
    aggregateType: 'product',
    aggregateId: product.id,
    tenantId: product.tenantId,
    payload: {
      productId: product.id,
      previousStatus,
      status: product.status,
    },
    correlationId: correlationId(),
  };
}
