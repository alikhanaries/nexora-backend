import { getRequestContext } from '../../../shared/context/request-context.js';
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
function offerPayload(offer) {
    return {
        id: offer.id,
        tenantId: offer.tenantId,
        productId: offer.productId,
        channelId: offer.channelId,
        status: offer.status,
        externalReference: offer.externalReference,
        priceReference: offer.priceReference,
        listingStatus: offer.listingStatus,
    };
}
export function offerCreatedEvent(offer) {
    return {
        type: 'offer.created',
        version: 1,
        aggregateType: 'offer',
        aggregateId: offer.id,
        tenantId: offer.tenantId,
        payload: offerPayload(offer),
        correlationId: correlationId(),
    };
}
export function offerUpdatedEvent(offer, changes) {
    return {
        type: 'offer.updated',
        version: 1,
        aggregateType: 'offer',
        aggregateId: offer.id,
        tenantId: offer.tenantId,
        payload: {
            ...offerPayload(offer),
            changes,
        },
        correlationId: correlationId(),
    };
}
export function offerStatusChangedEvent(offer, previousStatus) {
    return {
        type: 'offer.status_changed',
        version: 1,
        aggregateType: 'offer',
        aggregateId: offer.id,
        tenantId: offer.tenantId,
        payload: {
            ...offerPayload(offer),
            previousStatus,
        },
        correlationId: correlationId(),
    };
}
