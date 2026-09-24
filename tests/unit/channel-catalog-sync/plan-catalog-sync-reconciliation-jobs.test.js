import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { planCatalogSyncJobsForReconciliationOffer } from '../../../src/modules/channel-catalog-sync/application/plan-catalog-sync-reconciliation-jobs.js';

describe('planCatalogSyncJobsForReconciliationOffer', () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const channelId = '22222222-2222-4222-8222-222222222222';
    const productId = '33333333-3333-4333-8333-333333333333';
    const offerId = '44444444-4444-4444-8444-444444444444';
    const sourceEventId = '55555555-5555-4555-8555-555555555555';
    const channel = {
        id: channelId,
        tenantId,
        defaultStockLocationId: '66666666-6666-4666-8666-666666666666',
        configurationReference: null,
    };

    it('skips offers without external catalog reference', async () => {
        const result = await planCatalogSyncJobsForReconciliationOffer(
            {
                id: offerId,
                tenantId,
                channelId,
                productId,
                externalReference: null,
            },
            channel,
            sourceEventId,
            'catalog-sync-reconciliation',
            undefined,
        );
        expect(result.skippedOffer).toBe(true);
        expect(result.jobs).toEqual([]);
    });

    it('plans product, offer, inventory, and price jobs without embedding domain snapshots', async () => {
        const listPrices = vi.fn().mockResolvedValue({
            items: [{ currency: 'USD' }, { currency: 'EUR' }],
        });
        const result = await planCatalogSyncJobsForReconciliationOffer(
            {
                id: offerId,
                tenantId,
                channelId,
                productId,
                externalReference: 'listing-1',
            },
            channel,
            sourceEventId,
            'catalog-sync-reconciliation',
            { listPrices },
        );
        expect(result.skippedOffer).toBe(false);
        expect(result.jobs.map((job) => job.target)).toEqual([
            CatalogSyncTarget.PRODUCT,
            CatalogSyncTarget.OFFER,
            CatalogSyncTarget.INVENTORY,
            CatalogSyncTarget.PRICE,
            CatalogSyncTarget.PRICE,
        ]);
        for (const job of result.jobs) {
            expect(job.sourceEventId).toBe(sourceEventId);
            expect(job).not.toHaveProperty('productSnapshot');
            expect(job).not.toHaveProperty('priceSnapshot');
        }
        expect(listPrices).toHaveBeenCalledWith({
            tenantId,
            productId,
            channelId,
            limit: 100,
        });
    });
});
