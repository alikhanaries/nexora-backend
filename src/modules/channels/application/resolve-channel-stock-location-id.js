import { BusinessRuleError } from '../../../shared/errors/index.js';

const STOCK_LOCATION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves the stock location UUID used for channel-scoped inventory (ADR-022).
 *
 * Prefers `defaultStockLocationId` when set; otherwise uses legacy
 * `configurationReference` when it holds a stock location UUID.
 *
 * @param {object} channel
 * @returns {string|null} Resolved location id, or null when not configured.
 */
export function resolveChannelStockLocationId(channel) {
    const defaultStockLocationId = channel.defaultStockLocationId?.trim?.() ?? channel.defaultStockLocationId;
    if (defaultStockLocationId !== undefined &&
        defaultStockLocationId !== null &&
        String(defaultStockLocationId).length > 0) {
        const normalized = String(defaultStockLocationId).trim();
        if (!STOCK_LOCATION_UUID_PATTERN.test(normalized)) {
            throw new BusinessRuleError('Channel default stock location must be a stock location UUID', {
                channelId: channel.id,
                defaultStockLocationId: normalized,
            });
        }
        return normalized;
    }
    const configurationReference = channel.configurationReference?.trim?.() ?? channel.configurationReference;
    if (configurationReference === undefined ||
        configurationReference === null ||
        String(configurationReference).length === 0) {
        return null;
    }
    const normalizedReference = String(configurationReference).trim();
    if (!STOCK_LOCATION_UUID_PATTERN.test(normalizedReference)) {
        return null;
    }
    return normalizedReference;
}

/**
 * @param {object} channel
 * @returns {string}
 */
export function requireChannelStockLocationId(channel) {
    const stockLocationId = resolveChannelStockLocationId(channel);
    if (stockLocationId === null) {
        throw new BusinessRuleError('Channel stock location is not configured', {
            channelId: channel.id,
        });
    }
    return stockLocationId;
}
