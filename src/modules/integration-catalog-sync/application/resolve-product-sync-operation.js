import { CatalogSyncOperation } from '../domain/sync-operation.js';

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 */
export function resolveProductSyncOperation(eventType, payload) {
    if (eventType === 'product.status_changed') {
        const status = typeof payload.status === 'string' ? payload.status : null;
        if (status !== null && status !== 'ACTIVE') {
            return CatalogSyncOperation.DEACTIVATE;
        }
    }
    return CatalogSyncOperation.SYNC;
}
