import { describe, expect, it } from 'vitest';
import { buildCatalogSyncJobId } from '../../../src/modules/channel-catalog-sync/application/build-catalog-sync-job-id.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';

describe('buildCatalogSyncJobId', () => {
    const base = {
        tenantId: '11111111-1111-4111-8111-111111111111',
        channelId: '22222222-2222-4222-8222-222222222222',
        entityId: '33333333-3333-4333-8333-333333333333',
    };

    it('builds deterministic ids for the same inputs', () => {
        const first = buildCatalogSyncJobId({
            ...base,
            target: CatalogSyncTarget.OFFER,
        });
        const second = buildCatalogSyncJobId({
            ...base,
            target: CatalogSyncTarget.OFFER,
        });
        expect(first).toBe(second);
    });

    it('coalesces price jobs per tenant, channel, product, and currency', () => {
        const usd = buildCatalogSyncJobId({
            ...base,
            target: CatalogSyncTarget.PRICE,
            currency: 'USD',
        });
        const eur = buildCatalogSyncJobId({
            ...base,
            target: CatalogSyncTarget.PRICE,
            currency: 'EUR',
        });
        expect(usd).not.toBe(eur);
        expect(usd).toContain('USD');
    });

    it('coalesces inventory jobs per tenant, channel, and product', () => {
        const withLocation = buildCatalogSyncJobId({
            ...base,
            target: CatalogSyncTarget.INVENTORY,
            stockLocationId: '44444444-4444-4444-8444-444444444444',
        });
        const withoutLocation = buildCatalogSyncJobId({
            ...base,
            target: CatalogSyncTarget.INVENTORY,
        });
        expect(withLocation).toBe(withoutLocation);
        expect(withLocation).toContain('inventory');
    });
});
