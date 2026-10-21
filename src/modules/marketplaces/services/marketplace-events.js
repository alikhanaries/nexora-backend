import { getRequestContext } from '../../../shared/context/request-context.js';
/**
 * Reads requestId from async context for domain event correlation (outbound webhook dispatch).
 */
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
/**
 * Minimal aggregate fields included on integration events (tenantId on orders, null for global marketplaces).
 */
function marketplacePayload(marketplace) {
    return {
        id: marketplace.id,
        key: marketplace.key,
        name: marketplace.name,
        status: marketplace.status,
    };
}
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
/**
 * Builds versioned integration event envelope; consumed by outbound webhook dispatch when externally deliverable.
 */
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
