import { describe, expect, it, vi } from 'vitest';
import { resolveMarketplaceOrderLines } from '../../../src/modules/marketplace-order-ingestion/application/resolve-marketplace-order-lines.js';

describe('resolveMarketplaceOrderLines', () => {
    it('passes through merchantSku', async () => {
        const lines = await resolveMarketplaceOrderLines({
            marketplaceEntityMappingLookup: { findByExternalEntity: vi.fn() },
            productQueryService: { getProductById: vi.fn() },
        }, {
            tenantId: 't1',
            channelId: 'c1',
            marketplaceKey: 'noon',
            lines: [{
                quantity: 2,
                stockLocationId: 'loc-1',
                merchantSku: 'ABC',
            }],
        });
        expect(lines).toEqual([{
            stockLocationId: 'loc-1',
            quantity: 2,
            merchantSku: 'ABC',
        }]);
    });
    it('resolves offer mapping to offerId', async () => {
        const lines = await resolveMarketplaceOrderLines({
            marketplaceEntityMappingLookup: {
                findByExternalEntity: vi.fn().mockResolvedValue({
                    nexoraEntityType: 'offer',
                    nexoraEntityId: 'offer-uuid',
                    externalEntityType: 'noon_offer',
                    externalEntityId: 'EXT-1',
                }),
            },
            productQueryService: { getProductById: vi.fn() },
        }, {
            tenantId: 't1',
            channelId: 'c1',
            marketplaceKey: 'noon',
            lines: [{
                quantity: 1,
                stockLocationId: 'loc-1',
                marketplaceExternalEntity: {
                    externalEntityType: 'noon_offer',
                    externalEntityId: 'EXT-1',
                },
            }],
        });
        expect(lines[0].offerId).toBe('offer-uuid');
    });
});
