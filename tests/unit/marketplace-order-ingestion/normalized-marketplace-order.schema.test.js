import { describe, expect, it } from 'vitest';
import { normalizedMarketplaceOrderSchema } from '../../../src/modules/marketplace-order-ingestion/application/normalized-marketplace-order.schema.js';
import { NormalizedMarketplaceOrderStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';

const baseLine = {
    quantity: 1,
    stockLocationId: '00000000-0000-4000-8000-000000000010',
    merchantSku: 'SKU-1',
};

describe('normalizedMarketplaceOrderSchema', () => {
    it('accepts a minimal valid order', () => {
        const parsed = normalizedMarketplaceOrderSchema.parse({
            externalOrderId: 'mp-order-1',
            marketplaceKey: 'shopify',
            status: NormalizedMarketplaceOrderStatus.PENDING,
            currency: 'USD',
            lines: [baseLine],
        });
        expect(parsed.externalOrderId).toBe('mp-order-1');
    });
    it('rejects lines without product reference', () => {
        expect(() => normalizedMarketplaceOrderSchema.parse({
            externalOrderId: 'mp-order-1',
            marketplaceKey: 'shopify',
            status: NormalizedMarketplaceOrderStatus.PENDING,
            currency: 'USD',
            lines: [{
                quantity: 1,
                stockLocationId: '00000000-0000-4000-8000-000000000010',
            }],
        })).toThrow();
    });
});
