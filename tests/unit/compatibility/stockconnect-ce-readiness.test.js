import { describe, expect, it } from 'vitest';
import {
    assertCompatV2CompatibilityWired,
    createCompatV2CompatibilityReadinessProbe,
} from '../../../src/modules/compatibility/services/compat-v2-readiness.js';
import {
    assertStockConnectCeCompatibilityWired,
    createStockConnectCeCompatibilityReadinessProbe,
} from '../../../src/modules/compatibility/services/stockconnect-ce-readiness.js';

const wiredRouteDeps = {
    compatV2OrderQuery: {},
    compatV2CatalogCommand: {},
    compatV2OrderInvoiceQuery: {},
    compatV2IntegrationListQuery: {},
};

describe('compat-v2 readiness', () => {
    it('passes when required route deps are present', async () => {
        const probe = createCompatV2CompatibilityReadinessProbe(wiredRouteDeps);
        expect(probe.name).toBe('compat_v2_surface');
        await expect(probe.check()).resolves.toBeUndefined();
    });

    it('fails when route deps are missing', () => {
        expect(() => assertCompatV2CompatibilityWired(null)).toThrow(/missing/);
        expect(() => assertCompatV2CompatibilityWired({
            compatV2OrderQuery: {},
        })).toThrow(/External compatibility handler/);
    });
});

describe('stockconnect_ce_compat readiness (legacy alias)', () => {
    it('reports healthy when required route deps are present', async () => {
        const probe = createStockConnectCeCompatibilityReadinessProbe(wiredRouteDeps);
        expect(probe.name).toBe('stockconnect_ce_compat');
        await expect(probe.check()).resolves.toBeUndefined();
    });

    it('fails when route deps object is missing', async () => {
        const probe = createStockConnectCeCompatibilityReadinessProbe(null);
        await expect(probe.check()).rejects.toThrow(/missing/);
        expect(() => assertStockConnectCeCompatibilityWired(undefined)).toThrow(/missing/);
    });

    it('fails when a required handler is not wired', async () => {
        const probe = createStockConnectCeCompatibilityReadinessProbe({
            compatV2OrderQuery: {},
            compatV2CatalogCommand: {},
        });
        await expect(probe.check()).rejects.toThrow(/External compatibility handler/);
    });
});
