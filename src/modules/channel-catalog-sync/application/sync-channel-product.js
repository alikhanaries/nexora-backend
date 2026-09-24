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

export class SyncChannelProduct {
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
        if (job.target !== CatalogSyncTarget.PRODUCT) {
            return;
        }
        if (channel.tenantId !== job.tenantId) {
            throw new CatalogSyncPermanentError('Channel tenant mismatch', {
                tenantId: job.tenantId,
                channelId: job.channelId,
            });
        }
        const product = await this.deps.productQueryService.getProductById(job.tenantId, job.entityId, tx);
        if (product === null) {
            throw new CatalogSyncSkippedError('Product no longer exists', {
                productId: job.entityId,
            });
        }
        const offer = await this.deps.offerQueryService.getOfferForProductAndChannel(
            job.tenantId,
            job.entityId,
            job.channelId,
            tx,
        );
        if (offer === null) {
            throw new CatalogSyncSkippedError('No offer for product on channel', {
                productId: job.entityId,
                channelId: job.channelId,
            });
        }
        if (offer.channelId !== job.channelId) {
            throw new CatalogSyncPermanentError('Offer channel mismatch', {
                offerId: offer.id,
                channelId: job.channelId,
            });
        }
        const externalCatalogIdentifier = normalizeExternalCatalogReference(offer.externalReference);
        if (externalCatalogIdentifier === null && job.operation !== CatalogSyncOperation.DEACTIVATE) {
            throw new CatalogSyncPermanentError('Offer has no external catalog identifier for channel sync', {
                offerId: offer.id,
                channelId: job.channelId,
            });
        }
        if (job.operation === CatalogSyncOperation.DEACTIVATE ||
            product.status !== 'ACTIVE' ||
            offer.status !== 'ACTIVE') {
            await this.invokeAdapter(adapter, {
                tenantId: job.tenantId,
                channelId: job.channelId,
                marketplaceKey: marketplace.key,
                productId: product.id,
                merchantSku: product.merchantSku,
                productType: product.productType,
                productStatus: product.status,
                productExternalReference: normalizeExternalCatalogReference(product.externalReference),
                externalCatalogIdentifier: externalCatalogIdentifier ?? '',
                offerStatus: offer.status,
                listingStatus: offer.listingStatus,
                operation: CatalogSyncOperation.DEACTIVATE,
                sourceEventId: job.sourceEventId,
                correlationId: job.correlationId,
            });
            return;
        }
        await this.invokeAdapter(adapter, {
            tenantId: job.tenantId,
            channelId: job.channelId,
            marketplaceKey: marketplace.key,
            productId: product.id,
            merchantSku: product.merchantSku,
            productType: product.productType,
            productStatus: product.status,
            productExternalReference: normalizeExternalCatalogReference(product.externalReference),
            externalCatalogIdentifier: externalCatalogIdentifier,
            offerStatus: offer.status,
            listingStatus: offer.listingStatus,
            operation: job.operation,
            sourceEventId: job.sourceEventId,
            correlationId: job.correlationId,
        });
    }

    /**
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplaceCatalogAdapter} adapter
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplaceProductSyncInput} input
     */
    async invokeAdapter(adapter, input) {
        if (typeof adapter.syncProduct !== 'function') {
            throw new CatalogSyncSkippedError('Marketplace adapter does not implement product sync', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        try {
            await adapter.syncProduct(input);
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
