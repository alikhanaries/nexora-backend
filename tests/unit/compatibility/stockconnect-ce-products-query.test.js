import { describe, expect, it, vi } from 'vitest';
import { StockConnectCeProductsQuery } from '../../../src/modules/compatibility/application/stockconnect-ce-products-query.js';

describe('StockConnectCeProductsQuery', () => {
    it('returns CE product rows without requiring product content', async () => {
        const query = new StockConnectCeProductsQuery({
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
