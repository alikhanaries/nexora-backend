import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { TENANT_SETTING } from '../../src/infrastructure/postgres/postgres-database.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

function buildAppRoleUrl(databaseUrl) {
    const url = new URL(databaseUrl);
    url.username = 'nexora_app';
    if (url.password === '') {
        url.password = 'nexora';
    }
    return url.toString();
}

async function queryWithTenant(pool, tenantId, sql, params = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (tenantId !== null) {
            await client.query('SELECT set_config($1, $2, true)', [TENANT_SETTING, tenantId]);
        }
        const result = await client.query(sql, params);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}

describe('postgres RLS integration', () => {
    /** @type {import('pg').Pool} */
    let appRolePool;

    beforeAll(async () => {
        await getTestInfrastructure();
        const config = loadConfig(process.env);
        appRolePool = new Pool({
            connectionString: buildAppRoleUrl(config.database.url),
            max: 2,
        });
    });

    afterAll(async () => {
        await appRolePool?.end().catch(() => undefined);
        await closeTestInfrastructure();
    });

    it('denies cross-tenant reads under the nexora_app runtime role', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const productRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/products',
            headers: authHeaders(userA.accessToken),
            payload: { merchantSku: `RLS-${Date.now()}`, productType: 'STANDARD' },
        });
        expect(productRes.statusCode).toBe(201);
        const productId = productRes.json().data.id;
        const ownTenant = await queryWithTenant(appRolePool, tenantA.tenantId, 'SELECT id FROM products WHERE id = $1', [productId]);
        expect(ownTenant.rowCount).toBe(1);
        const crossTenant = await queryWithTenant(appRolePool, tenantB.tenantId, 'SELECT id FROM products WHERE id = $1', [productId]);
        expect(crossTenant.rowCount).toBe(0);
        await app.httpServer.close();
    });

    it('returns no tenant rows when tenant context is missing', async () => {
        const result = await queryWithTenant(appRolePool, null, 'SELECT id FROM products LIMIT 1');
        expect(result.rowCount).toBe(0);
    });

    it('prevents cross-tenant mutation under the nexora_app runtime role', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const productRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/products',
            headers: authHeaders(userA.accessToken),
            payload: { merchantSku: `RLS-MUT-${Date.now()}`, productType: 'STANDARD' },
        });
        expect(productRes.statusCode).toBe(201);
        const productId = productRes.json().data.id;
        const updateAttempt = await queryWithTenant(appRolePool, tenantB.tenantId, `UPDATE products SET merchant_sku = $2 WHERE id = $1`, [productId, 'Hijacked']);
        expect(updateAttempt.rowCount).toBe(0);
        const verify = await queryWithTenant(appRolePool, tenantA.tenantId, 'SELECT merchant_sku FROM products WHERE id = $1', [productId]);
        expect(verify.rows[0]?.merchant_sku).not.toBe('Hijacked');
        await app.httpServer.close();
    });
});
