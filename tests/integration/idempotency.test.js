import { afterAll, describe, expect, it } from 'vitest';
import { IdempotencyConflictError, IdempotentRequestInProgressError, } from '../../src/shared/errors/index.js';
import { fingerprintRequest } from '../../src/shared/idempotency/index.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('idempotency integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('replays the same request and rejects key reuse with different body', async () => {
        const infra = await getTestInfrastructure();
        const key = {
            tenantId: null,
            principalFingerprint: 'anonymous',
            routeId: 'POST /test',
            idempotencyKey: `key-${Date.now()}`,
        };
        const fingerprint = fingerprintRequest({ value: 1 });
        const first = await infra.idempotency.execute(key, fingerprint, async () => ({ ok: true }), () => ({ statusCode: 200, body: { ok: true } }));
        expect(first.kind).toBe('executed');
        const replay = await infra.idempotency.execute(key, fingerprint, async () => ({ ok: false }), () => ({ statusCode: 200, body: { ok: true } }));
        expect(replay.kind).toBe('replayed');
        await expect(infra.idempotency.execute(key, fingerprintRequest({ value: 2 }), async () => ({ ok: true }), () => ({ statusCode: 200, body: { ok: true } }))).rejects.toBeInstanceOf(IdempotencyConflictError);
    });
    it('handles concurrent duplicate requests safely', async () => {
        const infra = await getTestInfrastructure();
        const key = {
            tenantId: null,
            principalFingerprint: 'anonymous',
            routeId: 'POST /concurrent',
            idempotencyKey: `concurrent-${Date.now()}`,
        };
        const fingerprint = fingerprintRequest({ n: 1 });
        const results = await Promise.allSettled([
            infra.idempotency.execute(key, fingerprint, async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return 'done';
            }, () => ({ statusCode: 200, body: 'done' })),
            infra.idempotency.execute(key, fingerprint, async () => 'done', () => ({ statusCode: 200, body: 'done' })),
        ]);
        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const rejected = results.filter((result) => result.status === 'rejected');
        expect(fulfilled.length + rejected.length).toBe(2);
        expect(rejected.some((result) => result.reason instanceof IdempotentRequestInProgressError)).toBe(true);
    });
});
