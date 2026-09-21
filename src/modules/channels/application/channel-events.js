import { getRequestContext } from '../../../shared/context/request-context.js';
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
function channelPayload(channel) {
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
export function channelCreatedEvent(channel) {
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
export function channelUpdatedEvent(channel) {
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
export function channelStatusChangedEvent(channel, previousStatus) {
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
