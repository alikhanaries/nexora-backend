import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { Marketplace } from '../domain/marketplace.js';

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function marketplacePayload(marketplace: Marketplace): Readonly<Record<string, unknown>> {
  return {
    id: marketplace.id,
    key: marketplace.key,
    name: marketplace.name,
    status: marketplace.status,
  };
}

export function marketplaceCreatedEvent(marketplace: Marketplace): NewIntegrationEvent {
  return {
    type: 'marketplace.created',
    version: 1,
    aggregateType: 'marketplace',
    aggregateId: marketplace.id,
    tenantId: null,
    payload: marketplacePayload(marketplace),
    correlationId: correlationId(),
  };
}

export function marketplaceUpdatedEvent(marketplace: Marketplace): NewIntegrationEvent {
  return {
    type: 'marketplace.updated',
    version: 1,
    aggregateType: 'marketplace',
    aggregateId: marketplace.id,
    tenantId: null,
    payload: marketplacePayload(marketplace),
    correlationId: correlationId(),
  };
}

export function marketplaceStatusChangedEvent(
  marketplace: Marketplace,
  previousStatus: string,
): NewIntegrationEvent {
  return {
    type: 'marketplace.status_changed',
    version: 1,
    aggregateType: 'marketplace',
    aggregateId: marketplace.id,
    tenantId: null,
    payload: {
      ...marketplacePayload(marketplace),
      previousStatus,
    },
    correlationId: correlationId(),
  };
}
