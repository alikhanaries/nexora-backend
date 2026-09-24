import { describe, expect, it, vi } from 'vitest';
import { MarketplaceEntityMappingService } from '../../../src/modules/marketplaces/application/marketplace-entity-mapping-service.js';
import { ValidationError } from '../../../src/shared/errors/index.js';

describe('MarketplaceEntityMappingService', () => {
    it('upserts through repository', async () => {
        const upsert = vi.fn().mockResolvedValue(undefined);
        const service = new MarketplaceEntityMappingService({
            mappings: { upsert },
        });
        const tx = {};
        await service.upsertMapping({
            tenantId: '11111111-1111-4111-8111-111111111111',
            channelId: '22222222-2222-4222-8222-222222222222',
            marketplaceKey: 'shopify',
            nexoraEntityType: 'offer',
            nexoraEntityId: '33333333-3333-4333-8333-333333333333',
            externalEntityType: 'shopify_product_variant',
            externalEntityId: 'gid://shopify/ProductVariant/1',
            tx,
        });
        expect(upsert).toHaveBeenCalledOnce();
    });

    it('rejects invalid nexora entity type', async () => {
        const service = new MarketplaceEntityMappingService({ mappings: { upsert: vi.fn() } });
        await expect(service.upsertMapping({
            tenantId: '11111111-1111-4111-8111-111111111111',
            channelId: '22222222-2222-4222-8222-222222222222',
            marketplaceKey: 'shopify',
            nexoraEntityType: 'order',
            nexoraEntityId: '33333333-3333-4333-8333-333333333333',
            externalEntityType: 'x',
            externalEntityId: 'y',
            tx: {},
        })).rejects.toBeInstanceOf(ValidationError);
    });
});
