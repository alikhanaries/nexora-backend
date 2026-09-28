import { describe, expect, it } from 'vitest';
import {
    resolveStockConnectCeIdempotencyKey,
    stableIdempotencyFingerprint,
} from '../../../src/modules/compatibility/application/resolve-stockconnect-ce-idempotency-key.js';

describe('StockConnect CE idempotency', () => {
    it('uses explicit Idempotency-Key when provided', () => {
        const key = resolveStockConnectCeIdempotencyKey({
            header: '  client-key  ',
            tenantId: 'tenant-1',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint: '{}',
        });
        expect(key).toBe('client-key');
    });

    it('derives deterministic key when header is missing', () => {
        const body = { MerchantOrderNo: 'ORD-1', OrderId: 42 };
        const fingerprint = stableIdempotencyFingerprint(body);
        const first = resolveStockConnectCeIdempotencyKey({
            header: undefined,
            tenantId: 'tenant-1',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        const second = resolveStockConnectCeIdempotencyKey({
            header: undefined,
            tenantId: 'tenant-1',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        expect(first).toBe(second);
        expect(first.startsWith('ce-compat:')).toBe(true);
    });

    it('scopes derived keys to tenant and route', () => {
        const fingerprint = stableIdempotencyFingerprint({ MerchantOrderNo: 'X' });
        const tenantA = resolveStockConnectCeIdempotencyKey({
            header: undefined,
            tenantId: 'tenant-a',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        const tenantB = resolveStockConnectCeIdempotencyKey({
            header: undefined,
            tenantId: 'tenant-b',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        expect(tenantA).not.toBe(tenantB);
    });
});
