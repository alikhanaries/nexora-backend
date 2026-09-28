import { describe, expect, it } from 'vitest';
import {
    mapCeOfferPriceRequest,
    mapCeOfferStockLine,
} from '../../../src/modules/compatibility/application/mappers/compatibility-catalog-offer.mapper.js';

describe('compatibility catalog offer mapper', () => {
    it('maps offer price request to minor units', () => {
        const mapped = mapCeOfferPriceRequest({
            MerchantProductNo: 'SKU-1',
            Price: 12.34,
            CurrencyCode: 'USD',
            ChannelId: 'CH-1',
        });
        expect(mapped.merchantSku).toBe('SKU-1');
        expect(mapped.amountMinor).toBe(1234);
        expect(mapped.currency).toBe('USD');
        expect(mapped.channelIdFromBody).toBe('CH-1');
    });

    it('maps offer stock line', () => {
        expect(mapCeOfferStockLine({
            MerchantProductNo: 'SKU-2',
            Stock: '5',
            ChannelId: 99,
        })).toEqual({
            merchantSku: 'SKU-2',
            channelIdFromBody: 99,
            stock: 5,
        });
    });
});
