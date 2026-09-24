import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('marketplace connection and entity mapping foundation', () => {
    let app;
    let server;
    let database;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        database = infra.database;
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('CRUDs marketplace connection without returning secrets', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const base = `/api/v1/channels/${fixture.channelId}/marketplace-connection`;

        const createRes = await server.inject({
            method: 'POST',
            url: base,
            headers,
            payload: {
                credentials: { accessToken: 'shpat_test_secret', shopDomain: 'example.myshopify.com' },
                configuration: { shopifyLocationId: '1' },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const created = createRes.json().data;
        expect(created.credentials).toBeUndefined();
        expect(created.configuration.shopifyLocationId).toBe('1');
        expect(JSON.stringify(createRes.body)).not.toContain('shpat_test_secret');

        const getRes = await server.inject({ method: 'GET', url: base, headers });
        expect(getRes.statusCode).toBe(200);
        expect(JSON.stringify(getRes.body)).not.toContain('shpat_test_secret');

        const patchRes = await server.inject({
            method: 'PATCH',
            url: base,
            headers,
            payload: { configuration: { shopifyLocationId: '2' } },
        });
        expect(patchRes.statusCode).toBe(200);
        expect(patchRes.json().data.configuration.shopifyLocationId).toBe('2');

        const ciphertextRow = await database.execute(async (tx) => {
            const result = await tx.query(`SELECT credentials_ciphertext FROM marketplace_connections
         WHERE tenant_id = $1 AND channel_id = $2 AND status = 'ACTIVE'`, [
                tenantId,
                fixture.channelId,
            ]);
            return result.rows[0]?.credentials_ciphertext;
        }, { tenantId });
        expect(typeof ciphertextRow).toBe('string');
        expect(ciphertextRow).not.toContain('shpat_test_secret');

        const deleteRes = await server.inject({ method: 'DELETE', url: base, headers });
        expect(deleteRes.statusCode).toBe(200);

        const missingRes = await server.inject({ method: 'GET', url: base, headers });
        expect(missingRes.statusCode).toBe(404);
    });

    it('upserts marketplace entity mappings with uniqueness', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const offerId = fixture.offerId ?? '33333333-3333-4333-8333-833333333333';
        const channelRes = await server.inject({
            method: 'GET',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
        });
        const marketplaceId = channelRes.json().data.marketplaceId;
        const marketplaceRes = await server.inject({
            method: 'GET',
            url: `/api/v1/marketplaces/${marketplaceId}`,
            headers,
        });
        const marketplaceKey = marketplaceRes.json().data.key;

        await database.execute(async (tx) => {
            await tx.query(`INSERT INTO marketplace_entity_mappings (
          id, tenant_id, channel_id, marketplace_key, nexora_entity_type, nexora_entity_id,
          external_entity_type, external_entity_id
        ) VALUES ($1, $2, $3, $4, 'offer', $5, 'listing', 'ext-a')
        ON CONFLICT (tenant_id, channel_id, marketplace_key, nexora_entity_type, nexora_entity_id)
        DO UPDATE SET external_entity_id = EXCLUDED.external_entity_id, updated_at = now()`, [
                '44444444-4444-4444-8444-444444444444',
                tenantId,
                fixture.channelId,
                marketplaceKey,
                offerId,
            ]);
            await tx.query(`INSERT INTO marketplace_entity_mappings (
          id, tenant_id, channel_id, marketplace_key, nexora_entity_type, nexora_entity_id,
          external_entity_type, external_entity_id
        ) VALUES ($1, $2, $3, $4, 'offer', $5, 'listing', 'ext-b')
        ON CONFLICT (tenant_id, channel_id, marketplace_key, nexora_entity_type, nexora_entity_id)
        DO UPDATE SET external_entity_id = EXCLUDED.external_entity_id, updated_at = now()`, [
                '55555555-5555-4555-8555-555555555555',
                tenantId,
                fixture.channelId,
                marketplaceKey,
                offerId,
            ]);
            const result = await tx.query(`SELECT external_entity_id FROM marketplace_entity_mappings
         WHERE tenant_id = $1 AND nexora_entity_id = $2`, [tenantId, offerId]);
            expect(result.rows[0].external_entity_id).toBe('ext-b');
        }, { tenantId });
    });
});
