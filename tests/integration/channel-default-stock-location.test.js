import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { channelOrderHeaders, channelOrderPayload, seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const CHANNEL_ORDERS_URL = '/api/v2/orders';

describe('channel default stock location', () => {
    let app;
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('uses defaultStockLocationId for channel ingest without configurationReference', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);

        const patchRes = await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: {
                externalReference: 'channel-default-sl-ref',
                defaultStockLocationId: fixture.stockLocationId,
            },
        });
        expect(patchRes.statusCode).toBe(200);
        expect(patchRes.json().data.defaultStockLocationId).toBe(fixture.stockLocationId);

        const channelExternalReference = 'channel-default-sl-ref';
        const response = await server.inject({
            method: 'POST',
            url: CHANNEL_ORDERS_URL,
            headers: channelOrderHeaders(headers, 'channel-default-sl-ingest', channelExternalReference),
            payload: channelOrderPayload(fixture, `CH-${Date.now()}`, 1),
        });
        expect(response.statusCode).toBe(201);
    });

    it('rejects unknown defaultStockLocationId on channel update', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);

        const response = await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: {
                defaultStockLocationId: '00000000-0000-4000-8000-000000000099',
            },
        });
        expect(response.statusCode).toBe(404);
    });
});
