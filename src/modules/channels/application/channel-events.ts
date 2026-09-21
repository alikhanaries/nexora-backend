import { getRequestContext } from '../../../shared/context/request-context.js';
import type { NewIntegrationEvent } from '../../../shared/events/index.js';
import type { Channel } from '../domain/channel.js';

function correlationId(): string | null {
  return getRequestContext()?.requestId ?? null;
}

function channelPayload(channel: Channel): Readonly<Record<string, unknown>> {
  return {
    id: channel.id,
    tenantId: channel.tenantId,
    marketplaceId: channel.marketplaceId,
    name: channel.name,
    status: channel.status,
    externalReference: channel.externalReference,
    configurationReference: channel.configurationReference,
  };
}

export function channelCreatedEvent(channel: Channel): NewIntegrationEvent {
  return {
    type: 'channel.created',
    version: 1,
    aggregateType: 'channel',
    aggregateId: channel.id,
    tenantId: channel.tenantId,
    payload: channelPayload(channel),
    correlationId: correlationId(),
  };
}

export function channelUpdatedEvent(channel: Channel): NewIntegrationEvent {
  return {
    type: 'channel.updated',
    version: 1,
    aggregateType: 'channel',
    aggregateId: channel.id,
    tenantId: channel.tenantId,
    payload: channelPayload(channel),
    correlationId: correlationId(),
  };
}

export function channelStatusChangedEvent(
  channel: Channel,
  previousStatus: string,
): NewIntegrationEvent {
  return {
    type: 'channel.status_changed',
    version: 1,
    aggregateType: 'channel',
    aggregateId: channel.id,
    tenantId: channel.tenantId,
    payload: {
      ...channelPayload(channel),
      previousStatus,
    },
    correlationId: correlationId(),
  };
}
