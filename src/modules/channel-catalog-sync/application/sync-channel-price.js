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
export class SyncChannelPrice {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../pricing/public/pricing-service.js').DefaultPricingService} deps.pricingService
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
    async execute({ job, channel, marketplace, adapter, adapterRuntime, tx }) {
        if (job.target !== CatalogSyncTarget.PRICE) {
            return;
        }
        if (channel.tenantId !== job.tenantId) {
            throw new CatalogSyncPermanentError('Channel tenant mismatch', {
                tenantId: job.tenantId,
                channelId: job.channelId,
            });
        }
        const currency = job.currency;
        if (currency === undefined || currency.length === 0) {
            throw new CatalogSyncPermanentError('Price sync job is missing currency', {
                channelId: job.channelId,
                productId: job.entityId,
            });
        }
        await this.syncPriceForChannel({
            tenantId: job.tenantId,
            channelId: job.channelId,
            productId: job.entityId,
            currency,
            marketplaceKey: marketplace.key,
            sourceEventId: job.sourceEventId,
            correlationId: job.correlationId,
            adapter,
            adapterRuntime,
            tx,
        });
    }

    /**
     * @param {object} input
     */
    async syncPriceForChannel(input) {
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
        const effectivePrice = await this.deps.pricingService.getEffectivePrice(
            input.tenantId,
            input.productId,
            input.channelId,
            input.currency,
            new Date(),
            input.tx,
        );
        if (effectivePrice === null) {
            throw new CatalogSyncSkippedError('No effective price for product on channel', {
                tenantId: input.tenantId,
                channelId: input.channelId,
                productId: input.productId,
                currency: input.currency,
            });
        }
        if (typeof input.adapter.syncPrice !== 'function') {
            throw new CatalogSyncSkippedError('Marketplace adapter does not implement price sync', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        try {
            await input.adapter.syncPrice({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                productId: input.productId,
                externalCatalogIdentifier,
                currency: effectivePrice.currency,
                amountMinor: effectivePrice.amountMinor,
                validFrom: toIsoTimestamp(effectivePrice.validFrom),
                validTo: effectivePrice.validTo === null ? null : toIsoTimestamp(effectivePrice.validTo),
                priceId: effectivePrice.id,
                sourceEventId: input.sourceEventId,
                correlationId: input.correlationId,
            }, input.adapterRuntime ?? undefined);
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
/**
 * @param {Date|string} value
 */
function toIsoTimestamp(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value);
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
