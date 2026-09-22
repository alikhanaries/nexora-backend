import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { TENANT_SETTING } from '../../src/infrastructure/postgres/postgres-database.js';
import { createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

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
        await client.query('SELECT set_config($1, $2, true)', [TENANT_SETTING, tenantId]);
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

describe('webhook tenant isolation integration', () => {
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

    it('prevents cross-tenant subscription and delivery reads under RLS', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const created = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenantA.tenantId,
            actorId: userA.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/tenant-a',
            eventTypes: ['order.created'],
        });
        const eventId = randomUUID();
        const delivery = await app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenantA.tenantId,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        });
        const ownSubscription = await queryWithTenant(appRolePool, tenantA.tenantId, 'SELECT id FROM webhook_subscriptions WHERE id = $1', [created.subscription.id]);
        expect(ownSubscription.rowCount).toBe(1);
        const crossSubscription = await queryWithTenant(appRolePool, tenantB.tenantId, 'SELECT id FROM webhook_subscriptions WHERE id = $1', [created.subscription.id]);
        expect(crossSubscription.rowCount).toBe(0);
        const ownDelivery = await queryWithTenant(appRolePool, tenantA.tenantId, 'SELECT id FROM webhook_deliveries WHERE id = $1', [delivery.delivery.id]);
        expect(ownDelivery.rowCount).toBe(1);
        const crossDelivery = await queryWithTenant(appRolePool, tenantB.tenantId, 'SELECT id FROM webhook_deliveries WHERE id = $1', [delivery.delivery.id]);
        expect(crossDelivery.rowCount).toBe(0);
        await app.httpServer.close();
    });
});
