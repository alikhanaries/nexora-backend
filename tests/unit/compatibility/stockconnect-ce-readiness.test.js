import { describe, expect, it } from 'vitest';
import {
    assertCompatV2CompatibilityWired,
    createCompatV2CompatibilityReadinessProbe,
} from '../../../src/modules/compatibility/application/compat-v2-readiness.js';

describe('StockConnect CE readiness', () => {
    it('passes when required route deps are present', async () => {
        const probe = createCompatV2CompatibilityReadinessProbe({
            compatV2OrderQuery: {},
            compatV2CatalogCommand: {},
            compatV2OrderInvoiceQuery: {},
            compatV2IntegrationListQuery: {},
        });
        await expect(probe.check()).resolves.toBeUndefined();
    });

    it('fails when route deps are missing', () => {
        expect(() => assertCompatV2CompatibilityWired(null)).toThrow(/missing/);
        expect(() => assertCompatV2CompatibilityWired({
            compatV2OrderQuery: {},
        })).toThrow(/External compatibility handler/);
    });
});
