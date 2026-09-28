import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NormalizedMarketplaceOrderStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { mapFbpiOrderPayloadToNormalizedMarketplaceOrder } from '../../../src/modules/marketplaces/infrastructure/adapters/shared/map-fbpi-order-payload-to-normalized.js';

describe('mapFbpiOrderPayloadToNormalizedMarketplaceOrder', () => {
    it('maps GetFbpiOrder payload to pending normalized order', () => {
        const stockLocationId = randomUUID();
        const normalized = mapFbpiOrderPayloadToNormalizedMarketplaceOrder({
            marketplaceKey: 'noon',
            stockLocationId,
            orderPayload: {
                fbpi_order_nr: 'N123',
                currency_code: 'SAR',
                items: [{ partner_sku: 'SKU-A', mp_item_nr: 'line-1' }],
            },
        });
        expect(normalized.externalOrderId).toBe('N123');
        expect(normalized.status).toBe(NormalizedMarketplaceOrderStatus.PENDING);
        expect(normalized.lines).toEqual([{
            quantity: 1,
            stockLocationId,
            merchantSku: 'SKU-A',
            externalLineId: 'line-1',
        }]);
    });
});
