import { getRequestContext } from '../../../shared/context/request-context.js';
/** Reads the current request id from async context for outbound domain events. */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
/** Serializes offer fields needed by downstream consumers (tenant id included). */
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
/** Builds a versioned integration event envelope for the offer aggregate. */
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
/** Builds a versioned integration event envelope for the offer aggregate. */
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
/** Builds a versioned integration event envelope for the offer aggregate. */
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
