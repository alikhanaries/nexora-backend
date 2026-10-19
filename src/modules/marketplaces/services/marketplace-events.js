import { getRequestContext } from '../../../shared/context/request-context.js';
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
function marketplacePayload(marketplace) {
    return {
        id: marketplace.id,
        key: marketplace.key,
        name: marketplace.name,
        status: marketplace.status,
    };
}
export function marketplaceCreatedEvent(marketplace) {
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
export function marketplaceUpdatedEvent(marketplace) {
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
export function marketplaceStatusChangedEvent(marketplace, previousStatus) {
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
