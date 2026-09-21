import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { InternalError } from '../../src/shared/errors/index.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
describe('PostgreSQL integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('connects and runs migrations', async () => {
        const infra = await getTestInfrastructure();
        await infra.database.healthCheck();
    });
    it('commits and rolls back transactions', async () => {
        const infra = await getTestInfrastructure();
        const marker = randomUUID();
        await infra.database.execute(async (tx) => {
            await tx.query('SELECT $1::text AS marker', [marker], { operation: 'test.commit' });
        });
        await expect(infra.database.execute(async (tx) => {
            await tx.query('SELECT $1::text AS marker', [marker], { operation: 'test.rollback' });
            throw new InternalError('force rollback');
        })).rejects.toBeInstanceOf(InternalError);
    });
    it('keeps tenant context transaction-local', async () => {
        const infra = await getTestInfrastructure();
        const tenantA = '11111111-1111-1111-1111-111111111111';
        const tenantB = '22222222-2222-2222-2222-222222222222';
        const [resultA, resultB] = await Promise.all([
            infra.database.execute(async (tx) => {
                const row = await tx.query('SELECT app.current_tenant_id() AS tenant_id', [], {
                    operation: 'test.tenant_a',
                });
                await new Promise((resolve) => setTimeout(resolve, 50));
                return row.rows[0]?.['tenant_id'];
            }, { tenantId: tenantA }),
            infra.database.execute(async (tx) => {
                const row = await tx.query('SELECT app.current_tenant_id() AS tenant_id', [], {
                    operation: 'test.tenant_b',
                });
                return row.rows[0]?.['tenant_id'];
            }, { tenantId: tenantB }),
        ]);
        expect(String(resultA)).toBe(tenantA);
        expect(String(resultB)).toBe(tenantB);
    });
});
