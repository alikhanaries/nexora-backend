import { describe, expect, it } from 'vitest';
import {
    resolveCompatV2IdempotencyKey,
    stableIdempotencyFingerprint,
} from '../../../src/modules/compatibility/application/resolve-compat-v2-idempotency-key.js';

describe('StockConnect CE idempotency', () => {
    it('uses explicit Idempotency-Key when provided', () => {
        const key = resolveCompatV2IdempotencyKey({
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
        const first = resolveCompatV2IdempotencyKey({
            header: undefined,
            tenantId: 'tenant-1',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        const second = resolveCompatV2IdempotencyKey({
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
        const tenantA = resolveCompatV2IdempotencyKey({
            header: undefined,
            tenantId: 'tenant-a',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        const tenantB = resolveCompatV2IdempotencyKey({
            header: undefined,
            tenantId: 'tenant-b',
            routeId: 'POST /api/v2/ce/orders/acknowledge',
            fingerprint,
        });
        expect(tenantA).not.toBe(tenantB);
    });
});
