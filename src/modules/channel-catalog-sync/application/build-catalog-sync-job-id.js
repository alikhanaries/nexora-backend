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
    // Inventory coalesces per channel + product so rapid changes publish the latest
    // authoritative quantity read at job execution time (ADR-028 §12.2).
    if (input.target === CatalogSyncTarget.INVENTORY) {
        return `${input.tenantId}:${input.channelId}:${input.target}:${input.entityId}`;
    }
    return `${input.tenantId}:${input.channelId}:${input.target}:${input.entityId}`;
}
