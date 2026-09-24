import { CatalogSyncTarget } from '../domain/sync-target.js';

/**
 * Deterministic BullMQ job id for coalescing (ADR-028 §12.2).
 *
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.channelId
 * @param {string} input.target
 * @param {string} input.entityId
 * @param {string} [input.stockLocationId]
 */
export function buildCatalogSyncJobId(input) {
    if (input.target === CatalogSyncTarget.INVENTORY && input.stockLocationId !== undefined) {
        return `${input.tenantId}:${input.channelId}:${input.target}:${input.entityId}:${input.stockLocationId}`;
    }
    return `${input.tenantId}:${input.channelId}:${input.target}:${input.entityId}`;
}
