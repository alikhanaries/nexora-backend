import { BusinessRuleError } from '../../../shared/errors/index.js';
import { resolveChannelStockLocationId } from '../../channels/public/resolve-channel-stock-location-id.js';
import { CatalogSyncTarget } from '../domain/sync-target.js';
import {
    CatalogSyncPermanentError,
    CatalogSyncRetryError,
    CatalogSyncSkippedError,
} from './catalog-sync-errors.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from './catalog-sync-adapter-errors.js';
import { readAvailableQuantityAtLocation } from './read-available-quantity.js';
import { applyMarketplaceSyncMappings } from './apply-marketplace-sync-mappings.js';

export class SyncChannelInventory {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../inventory/public/inventory-service.js').DefaultInventoryService} deps.inventoryService
     * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
     * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {import('./catalog-sync-job.schema.js').CatalogSyncJobPayload} input.job
     * @param {object} input.channel
     * @param {object} input.marketplace
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplaceCatalogAdapter} input.adapter
     * @param {object} input.tx
     */
    async execute({ job, channel, marketplace, adapter, adapterRuntime, mappingRecorder, tx }) {
        if (channel.tenantId !== job.tenantId) {
            throw new CatalogSyncPermanentError('Channel tenant mismatch', {
                tenantId: job.tenantId,
                channelId: job.channelId,
            });
        }
        let channelStockLocationId;
        try {
            channelStockLocationId = resolveChannelStockLocationId(channel);
        }
        catch (error) {
            if (error instanceof BusinessRuleError) {
                throw new CatalogSyncSkippedError(error.message, {
                    channelId: channel.id,
                    ...(error.safeDetails ?? {}),
                });
            }
            throw error;
        }
        if (channelStockLocationId === null) {
            throw new CatalogSyncSkippedError('Channel stock location is not configured', {
                channelId: channel.id,
            });
        }
        if (job.target === CatalogSyncTarget.INVENTORY) {
            if (job.stockLocationId !== undefined && job.stockLocationId !== channelStockLocationId) {
                throw new CatalogSyncSkippedError('Inventory job stock location no longer matches channel configuration', {
                    channelId: channel.id,
                    jobStockLocationId: job.stockLocationId,
                    channelStockLocationId,
                });
            }
            await this.syncProductForChannel({
                tenantId: job.tenantId,
                channelId: job.channelId,
                productId: job.entityId,
                stockLocationId: channelStockLocationId,
                marketplaceKey: marketplace.key,
                sourceEventId: job.sourceEventId,
                correlationId: job.correlationId,
                adapter,
                adapterRuntime,
                mappingRecorder,
                tx,
            });
            return;
        }
        if (job.target === CatalogSyncTarget.CHANNEL_INVENTORY_RESYNC) {
            const offers = await this.deps.offerQueryService.listActiveOffersByChannel(job.tenantId, job.channelId, tx);
            for (const offer of offers) {
                await this.syncProductForChannel({
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    productId: offer.productId,
                    stockLocationId: channelStockLocationId,
                    marketplaceKey: marketplace.key,
                    sourceEventId: job.sourceEventId,
                    correlationId: job.correlationId,
                    adapter,
                    adapterRuntime,
                    mappingRecorder,
                    tx,
                });
            }
        }
    }

    /**
     * @param {object} input
     */
    async syncProductForChannel(input) {
        const offer = await this.deps.offerQueryService.getOfferForProductAndChannel(
            input.tenantId,
            input.productId,
            input.channelId,
            input.tx,
        );
        if (offer === null || offer.status !== 'ACTIVE') {
            throw new CatalogSyncSkippedError('No active offer for product on channel', {
                tenantId: input.tenantId,
                channelId: input.channelId,
                productId: input.productId,
            });
        }
        const externalCatalogIdentifier = normalizeExternalCatalogIdentifier(offer.externalReference);
        if (externalCatalogIdentifier === null) {
            throw new CatalogSyncPermanentError('Offer has no external catalog identifier for channel sync', {
                tenantId: input.tenantId,
                channelId: input.channelId,
                offerId: offer.id,
            });
        }
        const availability = await this.deps.inventoryService.getAvailability(
            input.tenantId,
            input.productId,
            input.stockLocationId,
            input.tx,
        );
        const availableQuantity = readAvailableQuantityAtLocation(availability, input.stockLocationId);
        if (typeof input.adapter.syncInventory !== 'function') {
            throw new CatalogSyncSkippedError('Marketplace adapter does not implement inventory sync', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        try {
            const syncResult = await input.adapter.syncInventory({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                productId: input.productId,
                externalCatalogIdentifier,
                stockLocationId: input.stockLocationId,
                availableQuantity,
                sourceEventId: input.sourceEventId,
                correlationId: input.correlationId,
            }, input.adapterRuntime ?? undefined);
            await applyMarketplaceSyncMappings(input.mappingRecorder, syncResult, {
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                tx: input.tx,
            });
        }
        catch (error) {
            if (error instanceof MarketplaceCatalogAdapterRetryError) {
                throw new CatalogSyncRetryError(error.message, {
                    retryDelayMs: error.retryDelayMs,
                });
            }
            if (error instanceof MarketplaceCatalogAdapterPermanentError) {
                throw new CatalogSyncPermanentError(error.message, error.safeDetails ?? {});
            }
            throw error;
        }
    }
}

/**
 * @param {string|null|undefined} externalReference
 * @returns {string|null}
 */
function normalizeExternalCatalogIdentifier(externalReference) {
    if (externalReference === null || externalReference === undefined) {
        return null;
    }
    const normalized = String(externalReference).trim();
    return normalized.length > 0 ? normalized : null;
}
