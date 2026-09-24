import { ChannelStatus, resolveChannelStockLocationId } from '../../channels/public/index.js';
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
 * @property {string} [currency]
 */

/**
 * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
 * @param {object} deps
 * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
 * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('../../pricing/public/pricing-service.js').DefaultPricingService} [deps.pricingService]
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
    if (type === 'offer.status_changed') {
        const channelId = readUuid(payload, 'channelId');
        const productId = readUuid(payload, 'productId');
        const status = typeof payload.status === 'string' ? payload.status : null;
        if (channelId === null || productId === null || status !== 'ACTIVE') {
            return [];
        }
        return planPriceJobsForOfferActivation(tenantId, productId, channelId, base, deps.pricingService);
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
        const productId = readUuid(payload, 'productId');
        const currency = readCurrencyCode(payload, 'currency');
        if (channelId === null || productId === null || currency === null) {
            return [];
        }
        jobs.push({
            ...base,
            channelId,
            target: CatalogSyncTarget.PRICE,
            entityId: productId,
            currency,
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
    return channels.filter((channel) => {
        try {
            return resolveChannelStockLocationId(channel) === stockLocationId;
        }
        catch {
            return false;
        }
    });
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

/**
 * @param {Record<string, unknown>} payload
 * @param {string} key
 */
function readCurrencyCode(payload, key) {
    const value = payload[key];
    if (typeof value !== 'string' || value.length !== 3) {
        return null;
    }
    return value.toUpperCase();
}

/**
 * @param {string} tenantId
 * @param {string} productId
 * @param {string} channelId
 * @param {Omit<PlannedCatalogSyncJob, 'channelId' | 'target' | 'entityId' | 'currency'>} base
 * @param {import('../../pricing/public/pricing-service.js').DefaultPricingService | undefined} pricingService
 */
async function planPriceJobsForOfferActivation(tenantId, productId, channelId, base, pricingService) {
    if (pricingService === undefined) {
        return [];
    }
    const page = await pricingService.listPrices({
        tenantId,
        productId,
        channelId,
        limit: 100,
    });
    const currencies = [...new Set(page.items.map((price) => price.currency))];
    return currencies.map((currency) => ({
        ...base,
        channelId,
        target: CatalogSyncTarget.PRICE,
        entityId: productId,
        currency,
    }));
}
