import { describe, expect, it } from 'vitest';
import {
    mapStockConnectCeChannelProductCollection,
    mapStockConnectCeChannelProductItem,
} from '../../../src/modules/compatibility/application/mappers/stockconnect-ce-channel-product.mapper.js';

describe('stockconnect-ce-channel-product.mapper', () => {
    it('maps offer status to CE ChannelStatus strings StockConnect stores', () => {
        expect(mapStockConnectCeChannelProductItem(
            { merchantSku: 'SKU-1' },
            { status: 'ACTIVE' },
        )).toEqual({
            MerchantProductNo: 'SKU-1',
            ChannelStatus: 'PUBLISHED',
        });
        expect(mapStockConnectCeChannelProductItem(
            { merchantSku: 'SKU-2' },
            { status: 'SUSPENDED' },
        ).ChannelStatus).toBe('DISABLED');
    });

    it('uses Count for pagination total as productSyncService expects', () => {
        const envelope = mapStockConnectCeChannelProductCollection([{ MerchantProductNo: 'A', ChannelStatus: 'PUBLISHED' }], 1, 250);
        expect(envelope.Count).toBe(1);
        expect(envelope.Content).toHaveLength(1);
    });
});
