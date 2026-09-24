import { NotFoundError } from '../../../shared/errors/index.js';
import { CatalogSyncTarget } from '../domain/sync-target.js';
import { CatalogSyncOperation } from '../domain/sync-operation.js';
import {
    CatalogSyncPermanentError,
    CatalogSyncRetryError,
    CatalogSyncSkippedError,
} from './catalog-sync-errors.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from './catalog-sync-adapter-errors.js';
import { normalizeExternalCatalogReference } from './catalog-sync-external-reference.js';

export class SyncChannelOffer {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../products/public/product-query-service.js').DefaultProductQueryService} deps.productQueryService
     * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     */
    async execute({ job, channel, marketplace, adapter, tx }) {
        if (job.target !== CatalogSyncTarget.OFFER) {
            return;
        }
        if (channel.tenantId !== job.tenantId) {
            throw new CatalogSyncPermanentError('Channel tenant mismatch', {
                tenantId: job.tenantId,
                channelId: job.channelId,
            });
        }
        let offer;
        try {
            offer = await this.deps.offerQueryService.getOfferById(job.tenantId, job.entityId, tx);
        }
        catch (error) {
            if (error instanceof NotFoundError) {
                throw new CatalogSyncSkippedError('Offer no longer exists', {
                    offerId: job.entityId,
                });
            }
            throw error;
        }
        if (offer.channelId !== job.channelId) {
            throw new CatalogSyncPermanentError('Offer channel mismatch', {
                offerId: offer.id,
                channelId: job.channelId,
            });
        }
        const product = await this.deps.productQueryService.getProductById(job.tenantId, offer.productId, tx);
        if (product === null) {
            throw new CatalogSyncSkippedError('Product for offer no longer exists', {
                productId: offer.productId,
            });
        }
        const externalCatalogIdentifier = normalizeExternalCatalogReference(offer.externalReference);
        const operation = resolveOfferSyncOperation(job.operation, offer.status);
        if (externalCatalogIdentifier === null && operation !== CatalogSyncOperation.DEACTIVATE) {
            throw new CatalogSyncPermanentError('Offer has no external catalog identifier for channel sync', {
                offerId: offer.id,
            });
        }
        if (typeof adapter.syncOffer !== 'function') {
            throw new CatalogSyncSkippedError('Marketplace adapter does not implement offer sync', {
                marketplaceKey: marketplace.key,
            });
        }
        try {
            await adapter.syncOffer({
                tenantId: job.tenantId,
                channelId: job.channelId,
                marketplaceKey: marketplace.key,
                offerId: offer.id,
                productId: product.id,
                merchantSku: product.merchantSku,
                productExternalReference: normalizeExternalCatalogReference(product.externalReference),
                externalCatalogIdentifier: externalCatalogIdentifier ?? '',
                offerStatus: offer.status,
                listingStatus: offer.listingStatus,
                operation,
                sourceEventId: job.sourceEventId,
                correlationId: job.correlationId,
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
 * @param {string} jobOperation
 * @param {string} offerStatus
 */
function resolveOfferSyncOperation(jobOperation, offerStatus) {
    if (jobOperation === CatalogSyncOperation.ACTIVATE ||
        jobOperation === CatalogSyncOperation.DEACTIVATE) {
        return jobOperation;
    }
    if (offerStatus !== 'ACTIVE') {
        return CatalogSyncOperation.DEACTIVATE;
    }
    return CatalogSyncOperation.SYNC;
}
