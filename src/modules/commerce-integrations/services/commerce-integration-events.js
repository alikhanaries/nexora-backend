import { getRequestContext } from '../../../shared/context/request-context.js';

/** Request correlation id for domain events, when async context is set. */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}

/** Stable integration event payload fields (no timestamps). */
function channelPayload(channel) {
    return {
        id: channel.id,
        tenantId: channel.tenantId,
        marketplaceId: channel.marketplaceId,
        name: channel.name,
        status: channel.status,
        externalReference: channel.externalReference,
        configurationReference: channel.configurationReference,
        defaultStockLocationId: channel.defaultStockLocationId,
    };
}

/** Domain event after channel insert. */
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

/** Domain event after channel metadata update. */
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

/** Domain event when integration status transitions (includes previousStatus). */
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
