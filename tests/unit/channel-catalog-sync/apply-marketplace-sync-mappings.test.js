import { describe, expect, it, vi } from 'vitest';
import { applyMarketplaceSyncMappings } from '../../../src/modules/channel-catalog-sync/application/apply-marketplace-sync-mappings.js';

describe('applyMarketplaceSyncMappings', () => {
    it('no-ops when recorder is undefined', async () => {
        await expect(applyMarketplaceSyncMappings(undefined, [{
            nexoraEntityType: 'offer',
            nexoraEntityId: '33333333-3333-4333-8333-333333333333',
            externalEntityType: 'listing',
            externalEntityId: 'ext-1',
        }], {
            tenantId: 't',
            channelId: 'c',
            marketplaceKey: 'shopify',
            tx: {},
        })).resolves.toBeUndefined();
    });

    it('delegates to recorder when hints exist', async () => {
        const recordMappings = vi.fn().mockResolvedValue(undefined);
        await applyMarketplaceSyncMappings({ recordMappings }, [{
            nexoraEntityType: 'product',
            nexoraEntityId: '33333333-3333-4333-8333-333333333333',
            externalEntityType: 'listing',
            externalEntityId: 'ext-1',
        }], {
            tenantId: '11111111-1111-4111-8111-111111111111',
            channelId: '22222222-2222-4222-8222-222222222222',
            marketplaceKey: 'shopify',
            tx: {},
        });
        expect(recordMappings).toHaveBeenCalledOnce();
    });
});
