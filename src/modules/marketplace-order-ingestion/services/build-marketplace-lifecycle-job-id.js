import { createHash } from 'node:crypto';

/**
 * Deterministic BullMQ job id for lifecycle coalescing (same event + operation → same job id).
 *
 * @param {object} input
 * @param {string} input.channelId
 * @param {string} input.marketplaceKey
 * @param {string} input.externalEventId
 * @param {string} input.operation
 */
export function buildMarketplaceLifecycleJobId(input) {
    const material = [
        input.channelId,
        input.marketplaceKey,
        input.externalEventId,
        input.operation,
    ].join(':');
    const digest = createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 32);
    return `mlc-${digest}`;
}
