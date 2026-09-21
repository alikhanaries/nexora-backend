import { getRequestContext } from '../../../shared/context/request-context.js';
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
function pricePayload(price) {
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
export function priceCreatedEvent(price) {
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
export function priceUpdatedEvent(price, changes) {
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
export function priceChangedEvent(price, reason) {
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
