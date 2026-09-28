import { describe, expect, it } from 'vitest';
import {
    assertStockConnectCeCompatibilityWired,
    createStockConnectCeCompatibilityReadinessProbe,
} from '../../../src/modules/compatibility/application/stockconnect-ce-readiness.js';

describe('StockConnect CE readiness', () => {
    it('passes when required route deps are present', async () => {
        const probe = createStockConnectCeCompatibilityReadinessProbe({
            stockConnectCeOrderCompatibilityQuery: {},
            stockConnectCeCatalogCommand: {},
            stockConnectCeOrderInvoiceQuery: {},
            stockConnectCeChannelCompatibilityQuery: {},
        });
        await expect(probe.check()).resolves.toBeUndefined();
    });

    it('fails when route deps are missing', () => {
        expect(() => assertStockConnectCeCompatibilityWired(null)).toThrow(/missing/);
        expect(() => assertStockConnectCeCompatibilityWired({
            stockConnectCeOrderCompatibilityQuery: {},
        })).toThrow(/stockConnectCeCatalogCommand/);
    });
});
