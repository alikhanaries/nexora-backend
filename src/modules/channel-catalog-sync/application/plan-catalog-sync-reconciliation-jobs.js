import { BusinessRuleError } from '../../../shared/errors/index.js';
import { resolveChannelStockLocationId } from '../../channels/public/index.js';
import { CatalogSyncOperation } from '../domain/sync-operation.js';
import { CatalogSyncTarget } from '../domain/sync-target.js';
import { normalizeExternalCatalogReference } from './catalog-sync-external-reference.js';

/**
 * @typedef {import('./plan-catalog-sync-jobs.js').PlannedCatalogSyncJob} PlannedCatalogSyncJob
 */

/**
 * @typedef {object} ReconciliationPlanResult
 * @property {PlannedCatalogSyncJob[]} jobs
 * @property {boolean} skippedOffer
 * @property {string} [skipReason]
 */

/**
 * Plans outbound sync jobs for one active offer during reconciliation.
 *
 * Does not embed product/price/inventory snapshots — execution handlers re-read state.
 *
 * @param {object} offer
 * @param {string} offer.tenantId
 * @param {string} offer.channelId
 * @param {string} offer.productId
 * @param {string} offer.id
 * @param {string|null} offer.externalReference
 * @param {object} channel
 * @param {string} sourceEventId
 * @param {string} correlationId
 * @param {import('../../pricing/public/pricing-service.js').DefaultPricingService | undefined} pricingService
 * @returns {Promise<ReconciliationPlanResult>}
 */
export async function planCatalogSyncJobsForReconciliationOffer(
    offer,
    channel,
    sourceEventId,
    correlationId,
    pricingService,
) {
    if (offer.channelId !== channel.id || offer.tenantId !== channel.tenantId) {
        return { jobs: [], skippedOffer: true, skipReason: 'channel_mismatch' };
    }
    const externalRef = normalizeExternalCatalogReference(offer.externalReference);
    if (externalRef === null) {
        return { jobs: [], skippedOffer: true, skipReason: 'missing_external_reference' };
    }
    const base = {
        tenantId: offer.tenantId,
        channelId: offer.channelId,
        operation: CatalogSyncOperation.SYNC,
        sourceEventId,
        correlationId,
    };
    /** @type {PlannedCatalogSyncJob[]} */
    const jobs = [
        {
            ...base,
            target: CatalogSyncTarget.PRODUCT,
            entityId: offer.productId,
        },
        {
            ...base,
            target: CatalogSyncTarget.OFFER,
            entityId: offer.id,
        },
    ];
    try {
        const stockLocationId = resolveChannelStockLocationId(channel);
        jobs.push({
            ...base,
            target: CatalogSyncTarget.INVENTORY,
            entityId: offer.productId,
            stockLocationId,
        });
    }
    catch (error) {
        if (!(error instanceof BusinessRuleError)) {
            throw error;
        }
    }
    if (pricingService !== undefined) {
        const page = await pricingService.listPrices({
            tenantId: offer.tenantId,
            productId: offer.productId,
            channelId: offer.channelId,
            limit: 100,
        });
        const currencies = [...new Set(page.items.map((price) => price.currency))];
        for (const currency of currencies) {
            jobs.push({
                ...base,
                target: CatalogSyncTarget.PRICE,
                entityId: offer.productId,
                currency,
            });
        }
    }
    return { jobs, skippedOffer: false };
}
