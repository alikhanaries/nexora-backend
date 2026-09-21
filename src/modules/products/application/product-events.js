import { getRequestContext } from '../../../shared/context/request-context.js';
const EVENT_VERSION = 1;
function correlationId() {
    return getRequestContext()?.requestId ?? null;
}
export function productCreatedEvent(product) {
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
export function productUpdatedEvent(product, changes) {
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
export function productStatusChangedEvent(product, previousStatus) {
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
