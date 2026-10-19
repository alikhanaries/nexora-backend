import { describe, expect, it } from 'vitest';
import {
    mapCompatV2IntegrationProductCollection,
    mapCompatV2IntegrationProductItem,
} from '../../../src/modules/compatibility/application/mappers/compat-v2-integration-product.mapper.js';

describe('compat-v2-integration-product.mapper', () => {
    it('maps offer status to CE IntegrationStatus strings StockConnect stores', () => {
        expect(mapCompatV2IntegrationProductItem(
            { merchantSku: 'SKU-1' },
            { status: 'ACTIVE' },
        )).toEqual({
            MerchantProductNo: 'SKU-1',
            IntegrationStatus: 'PUBLISHED',
        });
        expect(mapCompatV2IntegrationProductItem(
            { merchantSku: 'SKU-2' },
            { status: 'SUSPENDED' },
        ).IntegrationStatus).toBe('DISABLED');
    });

    it('uses Count for pagination total as productSyncService expects', () => {
        const envelope = mapCompatV2IntegrationProductCollection([{ MerchantProductNo: 'A', IntegrationStatus: 'PUBLISHED' }], 1, 250);
        expect(envelope.Count).toBe(1);
        expect(envelope.Content).toHaveLength(1);
    });
});
