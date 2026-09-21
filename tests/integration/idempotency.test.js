import { afterAll, describe, expect, it } from 'vitest';
import { DatabaseError, IdempotencyConflictError, IdempotentRequestInProgressError, } from '../../src/shared/errors/index.js';
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
    it('does not re-execute the business operation after a transactional completion', async () => {
        const infra = await getTestInfrastructure();
        let operationCount = 0;
        const key = {
            tenantId: null,
            principalFingerprint: 'anonymous',
            routeId: 'POST /transactional',
            idempotencyKey: `transactional-${Date.now()}`,
        };
        const fingerprint = fingerprintRequest({ value: 'stable' });
        const first = await infra.idempotency.execute(key, fingerprint, async () => {
            operationCount += 1;
            return { ok: true };
        }, () => ({ statusCode: 200, body: { ok: true } }), { useTransaction: true });
        expect(first.kind).toBe('executed');
        expect(operationCount).toBe(1);
        const replay = await infra.idempotency.execute(key, fingerprint, async () => {
            operationCount += 1;
            return { ok: false };
        }, () => ({ statusCode: 200, body: { ok: true } }), { useTransaction: true });
        expect(replay.kind).toBe('replayed');
        expect(operationCount).toBe(1);
    });
    it('leaves processing state and avoids replay when completion persistence fails outside a transaction', async () => {
        const infra = await getTestInfrastructure();
        let operationCount = 0;
        const key = {
            tenantId: null,
            principalFingerprint: 'anonymous',
            routeId: 'POST /legacy-failure',
            idempotencyKey: `legacy-failure-${Date.now()}`,
        };
        const fingerprint = fingerprintRequest({ value: 'legacy' });
        const originalMarkCompleted = infra.idempotency.markCompleted.bind(infra.idempotency);
        infra.idempotency.markCompleted = async () => {
            throw new Error('completion persistence failed');
        };
        await expect(infra.idempotency.execute(key, fingerprint, async () => {
            operationCount += 1;
            return { ok: true };
        }, () => ({ statusCode: 200, body: { ok: true } }))).rejects.toThrow('completion persistence failed');
        expect(operationCount).toBe(1);
        infra.idempotency.markCompleted = originalMarkCompleted;
        await expect(infra.idempotency.execute(key, fingerprint, async () => {
            operationCount += 1;
            return { ok: false };
        }, () => ({ statusCode: 200, body: { ok: true } }))).rejects.toBeInstanceOf(IdempotentRequestInProgressError);
        expect(operationCount).toBe(1);
    });
    it('executes only one business operation when two concurrent retries claim a failed record', async () => {
        const infra = await getTestInfrastructure();
        const key = {
            tenantId: null,
            principalFingerprint: 'anonymous',
            routeId: 'POST /failed-retry',
            idempotencyKey: `failed-retry-${Date.now()}`,
        };
        const fingerprint = fingerprintRequest({ value: 'retry' });
        await expect(infra.idempotency.execute(key, fingerprint, async () => {
            throw new Error('business failure');
        }, () => ({ statusCode: 200, body: { ok: true } }))).rejects.toThrow('business failure');
        let operationCount = 0;
        const results = await Promise.allSettled([
            infra.idempotency.execute(key, fingerprint, async () => {
                operationCount += 1;
                await new Promise((resolve) => setTimeout(resolve, 100));
                return { ok: true };
            }, () => ({ statusCode: 200, body: { ok: true } }), { useTransaction: true }),
            infra.idempotency.execute(key, fingerprint, async () => {
                operationCount += 1;
                return { ok: true };
            }, () => ({ statusCode: 200, body: { ok: true } }), { useTransaction: true }),
        ]);
        expect(operationCount).toBe(1);
        const fulfilled = results.filter((result) => result.status === 'fulfilled');
        const rejected = results.filter((result) => result.status === 'rejected');
        expect(fulfilled.length + rejected.length).toBe(2);
        expect(fulfilled.length).toBeGreaterThanOrEqual(1);
        if (rejected.length > 0) {
            expect(rejected.some((result) => result.reason instanceof IdempotentRequestInProgressError)).toBe(true);
        }
    });
    it('rolls back the business transaction when completion update affects zero rows', async () => {
        const infra = await getTestInfrastructure();
        let operationCount = 0;
        const key = {
            tenantId: null,
            principalFingerprint: 'anonymous',
            routeId: 'POST /zero-row-completion',
            idempotencyKey: `zero-row-${Date.now()}`,
        };
        const fingerprint = fingerprintRequest({ value: 'zero-row' });
        const nullTenant = '00000000-0000-0000-0000-000000000000';
        await expect(infra.idempotency.execute(key, fingerprint, async (tx) => {
            operationCount += 1;
            await tx.query(`DELETE FROM idempotency_records
         WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
           AND principal_fingerprint = $3
           AND route_id = $4
           AND idempotency_key = $5`, [nullTenant, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'test.delete_idempotency' });
            return { ok: true };
        }, () => ({ statusCode: 200, body: { ok: true } }), { useTransaction: true })).rejects.toBeInstanceOf(DatabaseError);
        expect(operationCount).toBe(1);
        const replay = await infra.idempotency.execute(key, fingerprint, async () => {
            operationCount += 1;
            return { ok: true };
        }, () => ({ statusCode: 200, body: { ok: true } }), { useTransaction: true });
        expect(replay.kind).toBe('executed');
        expect(operationCount).toBe(2);
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
