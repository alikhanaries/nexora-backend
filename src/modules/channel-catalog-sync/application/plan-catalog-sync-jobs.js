import { ChannelStatus } from '../../channels/public/index.js';
import { CatalogSyncOperation } from '../domain/sync-operation.js';
import { CatalogSyncTarget } from '../domain/sync-target.js';
import { isCatalogSyncIntegrationEventType } from './catalog-sync-event-types.js';

/**
 * @typedef {object} PlannedCatalogSyncJob
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} target
 * @property {string} entityId
 * @property {string} operation
 * @property {string} sourceEventId
 * @property {string|null} correlationId
 * @property {string} [stockLocationId]
 */

/**
 * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
 * @param {object} deps
 * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
 * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 * @returns {Promise<PlannedCatalogSyncJob[]>}
 */
export async function planCatalogSyncJobsFromEvent(event, deps) {
    if (!isCatalogSyncIntegrationEventType(event.type)) {
        return [];
    }
    if (event.tenantId === null) {
        return [];
    }
    const tenantId = event.tenantId;
    const base = {
        tenantId,
        operation: CatalogSyncOperation.SYNC,
        sourceEventId: event.id,
        correlationId: event.correlationId,
    };
    /** @type {PlannedCatalogSyncJob[]} */
    const jobs = [];
    const type = event.type;
    const payload = event.payload;
    if (type.startsWith('product.')) {
        const productId = readUuid(payload, 'productId');
        if (productId === null) {
            return [];
        }
        const offers = await deps.offerQueryService.getOffersByProduct(tenantId, productId);
        for (const offer of offers) {
            jobs.push({
                ...base,
                channelId: offer.channelId,
                target: CatalogSyncTarget.PRODUCT,
                entityId: productId,
            });
        }
        return jobs;
    }
    if (type.startsWith('offer.')) {
        const channelId = readUuid(payload, 'channelId');
        const offerId = readUuid(payload, 'id') ?? event.aggregateId;
        if (channelId === null || offerId === null) {
            return [];
        }
        jobs.push({
            ...base,
            channelId,
            target: CatalogSyncTarget.OFFER,
            entityId: offerId,
        });
        return jobs;
    }
    if (type.startsWith('price.')) {
        const channelId = readNullableUuid(payload, 'channelId');
        const priceId = readUuid(payload, 'id') ?? event.aggregateId;
        if (channelId === null || priceId === null) {
            return [];
        }
        jobs.push({
            ...base,
            channelId,
            target: CatalogSyncTarget.PRICE,
            entityId: priceId,
        });
        return jobs;
    }
    if (type.startsWith('inventory.')) {
        const productId = readUuid(payload, 'productId');
        const stockLocationId = readUuid(payload, 'stockLocationId');
        if (productId === null || stockLocationId === null) {
            return [];
        }
        const channels = await listActiveChannelsForStockLocation(deps.channelQueryService, tenantId, stockLocationId);
        for (const channel of channels) {
            jobs.push({
                ...base,
                channelId: channel.id,
                target: CatalogSyncTarget.INVENTORY,
                entityId: productId,
                stockLocationId,
            });
        }
        return jobs;
    }
    if (type === 'channel.updated') {
        const channelId = readUuid(payload, 'id') ?? event.aggregateId;
        if (channelId === null) {
            return [];
        }
        jobs.push({
            ...base,
            channelId,
            target: CatalogSyncTarget.CHANNEL_INVENTORY_RESYNC,
            entityId: channelId,
        });
    }
    return jobs;
}

/**
 * @param {import('../../channels/public/index.js').DefaultChannelQueryService} channelQueryService
 * @param {string} tenantId
 * @param {string} stockLocationId
 */
async function listActiveChannelsForStockLocation(channelQueryService, tenantId, stockLocationId) {
    const channels = await channelQueryService.listChannels(tenantId, { status: ChannelStatus.ACTIVE });
    return channels.filter((channel) => channel.defaultStockLocationId === stockLocationId);
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} key
 */
function readUuid(payload, key) {
    const value = payload[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} key
 */
function readNullableUuid(payload, key) {
    const value = payload[key];
    if (value === null || value === undefined) {
        return null;
    }
    return typeof value === 'string' && value.length > 0 ? value : null;
}
