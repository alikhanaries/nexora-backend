import { describe, expect, it, vi } from 'vitest';
import { CompatV2ProductsQuery } from '../../../src/modules/compatibility/application/compat-v2-products-query.js';

describe('CompatV2ProductsQuery', () => {
    it('returns CE product rows without requiring product content', async () => {
        const query = new CompatV2ProductsQuery({
            authorization: { requirePermission: vi.fn() },
            productQueryService: {
                getProductBySku: vi.fn(async (_tenantId, sku) => (
                    sku === 'known-sku' ? { id: 'p1', merchantSku: 'known-sku' } : null
                )),
            },
        });
        const result = await query.listProductsByMerchantProductNos({
            tenantId: 'tenant-1',
            actorPermissions: ['products.read'],
            merchantProductNos: ['known-sku', 'missing'],
        });
        expect(result.Content).toEqual([{
            MerchantProductNo: 'known-sku',
            Name: null,
            Description: null,
            Brand: null,
            ExtraData: null,
        }]);
    });
});
