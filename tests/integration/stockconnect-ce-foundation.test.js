import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { ExternalIdMappingResourceType } from '../../src/modules/external-id-mapping/public/index.js';
import { apiKeyHeaders, authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import {
    acknowledgePayload,
    createOrder,
    findCompatExternalId,
    seedCommerceFixture,
    setOrderToNew,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function createOrdersReadApiKey(app, tenantId, user) {
    const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
        tenantId,
        actorPermissions: ['roles.read'],
        membershipId: user.membershipId,
    });
    return app.apiKeys.useCases.createApiKey.execute({
        tenantId,
        actorId: user.userId,
        actorPermissions: permissions.permissions,
        name: 'StockConnect CE poll key',
        scopes: ['orders.read'],
    });
}

async function createOrdersUpdateApiKey(app, tenantId, user) {
    const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
        tenantId,
        actorPermissions: ['roles.read'],
        membershipId: user.membershipId,
    });
    return app.apiKeys.useCases.createApiKey.execute({
        tenantId,
        actorId: user.userId,
        actorPermissions: permissions.permissions,
        name: 'StockConnect CE ack key',
        scopes: ['orders.update'],
    });
}

describe('StockConnect CE compatibility foundation', () => {
    let app;
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    describe('authentication (GET /api/v2/ce/orders)', () => {
        it('returns 401 without credentials', async () => {
            const response = await server.inject({ method: 'GET', url: '/api/v2/ce/orders' });
            expect(response.statusCode).toBe(401);
        });

        it('returns 401 for invalid query apiKey', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/api/v2/ce/orders?apiKey=nxk_invalid.invalidsecret',
            });
            expect(response.statusCode).toBe(401);
        });

        it('accepts valid query apiKey (apiKey)', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const apiKey = await createOrdersReadApiKey(app, tenantId, user);
            const response = await server.inject({
                method: 'GET',
                url: `/api/v2/ce/orders?page=1&pageSize=10&apiKey=${encodeURIComponent(apiKey.secret)}`,
            });
            expect(response.statusCode).toBe(200);
            expect(response.json().Success).toBe(true);
        });

        it('accepts valid query apikey (lowercase)', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const apiKey = await createOrdersReadApiKey(app, tenantId, user);
            const response = await server.inject({
                method: 'GET',
                url: `/api/v2/ce/orders?apikey=${encodeURIComponent(apiKey.secret)}`,
            });
            expect(response.statusCode).toBe(200);
        });

        it('isolates tenants', async () => {
            const tenantA = await createTestTenant(server);
            const tenantB = await createTestTenant(server);
            const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
            const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
            const headersA = authHeaders(userA.accessToken);
            const headersB = authHeaders(userB.accessToken);
            const fixtureA = await seedCommerceFixture(server, headersA);
            const fixtureB = await seedCommerceFixture(server, headersB);
            await createOrder(server, headersA, fixtureA, 'sc-ce-tenant-a');
            await createOrder(server, headersB, fixtureB, 'sc-ce-tenant-b');
            const keyA = await createOrdersReadApiKey(app, tenantA.tenantId, userA);
            const keyB = await createOrdersReadApiKey(app, tenantB.tenantId, userB);

            const responseA = await server.inject({
                method: 'GET',
                url: `/api/v2/ce/orders?apiKey=${encodeURIComponent(keyA.secret)}`,
            });
            const responseB = await server.inject({
                method: 'GET',
                url: `/api/v2/ce/orders?apiKey=${encodeURIComponent(keyB.secret)}`,
            });
            const channelOrderNosA = responseA.json().Content.map((entry) => entry.ChannelOrderNo);
            const channelOrderNosB = responseB.json().Content.map((entry) => entry.ChannelOrderNo);
            expect(channelOrderNosA).toContain('sc-ce-tenant-a');
            expect(channelOrderNosA).not.toContain('sc-ce-tenant-b');
            expect(channelOrderNosB).toContain('sc-ce-tenant-b');
            expect(channelOrderNosB).not.toContain('sc-ce-tenant-a');
        });
    });

    describe('orders (GET /api/v2/ce/orders)', () => {
        it('returns CE-style envelope with pagination query params', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const headers = authHeaders(user.accessToken);
            const fixture = await seedCommerceFixture(server, headers);
            await createOrder(server, headers, fixture, 'sc-ce-page');
            const apiKey = await createOrdersReadApiKey(app, tenantId, user);

            const response = await server.inject({
                method: 'GET',
                url: `/api/v2/ce/orders?page=1&pageSize=5&apiKey=${encodeURIComponent(apiKey.secret)}`,
            });
            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.Success).toBe(true);
            expect(body.TotalCount).toBeGreaterThanOrEqual(1);
            expect(body.ItemsPerPage).toBe(5);
            expect(body.Content.some((entry) => entry.ChannelOrderNo === 'sc-ce-page')).toBe(true);
        });

        it('includes StockConnect CE order fields when channel reference is numeric', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const headers = authHeaders(user.accessToken);
            const fixture = await seedCommerceFixture(server, headers);
            await server.inject({
                method: 'PATCH',
                url: `/api/v1/channels/${fixture.channelId}`,
                headers,
                payload: { externalReference: '1892' },
            });
            await createOrder(server, headers, fixture, 'sc-ce-channel-id');
            const apiKey = await createOrdersReadApiKey(app, tenantId, user);
            const response = await server.inject({
                method: 'GET',
                url: `/api/v2/ce/orders?apiKey=${encodeURIComponent(apiKey.secret)}`,
            });
            const entry = response.json().Content.find((row) => row.ChannelOrderNo === 'sc-ce-channel-id');
            expect(entry).toBeDefined();
            expect(entry.ChannelId).toBe(1892);
            expect(entry.GlobalChannelId).toBe(1892);
            expect(entry.Lines[0].ExtraData).toEqual([]);
        });

        it('does not change GET /api/v2/orders/new semantics', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const headers = authHeaders(user.accessToken);
            const fixture = await seedCommerceFixture(server, headers);
            await createOrder(server, headers, fixture, 'sc-ce-new-only');
            const newOnlyResponse = await server.inject({
                method: 'GET',
                url: '/api/v2/orders/new',
                headers,
            });
            expect(newOnlyResponse.statusCode).toBe(200);
            expect(newOnlyResponse.json().Content).toEqual([]);
        });
    });

    describe('idempotency (POST /api/v2/ce/orders/acknowledge)', () => {
        it('acknowledges without Idempotency-Key header using query apiKey', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const headers = authHeaders(user.accessToken);
            const fixture = await seedCommerceFixture(server, headers);
            const order = await createOrder(server, headers, fixture, 'sc-ce-ack');
            await setOrderToNew(app.infra.database, tenantId, order.id);
            const orderExternalId = await findCompatExternalId(
                app,
                tenantId,
                ExternalIdMappingResourceType.ORDER,
                order.id,
            );
            const apiKey = await createOrdersUpdateApiKey(app, tenantId, user);
            const payload = acknowledgePayload(order.orderNumber, orderExternalId);
            const url = `/api/v2/ce/orders/acknowledge?apiKey=${encodeURIComponent(apiKey.secret)}`;

            const first = await server.inject({ method: 'POST', url, payload });
            const second = await server.inject({ method: 'POST', url, payload });
            expect(first.statusCode).toBe(201);
            expect(second.statusCode).toBe(201);
        });

        it('still requires Idempotency-Key on existing POST /api/v2/orders/acknowledge', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const headers = authHeaders(user.accessToken);
            const fixture = await seedCommerceFixture(server, headers);
            const order = await createOrder(server, headers, fixture, 'sc-ce-legacy-ack');
            await setOrderToNew(app.infra.database, tenantId, order.id);
            const orderExternalId = await findCompatExternalId(
                app,
                tenantId,
                ExternalIdMappingResourceType.ORDER,
                order.id,
            );
            const response = await server.inject({
                method: 'POST',
                url: '/api/v2/orders/acknowledge',
                headers,
                payload: acknowledgePayload(order.orderNumber, orderExternalId),
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().Success).toBe(false);
        });

        it('accepts header Idempotency-Key on CE acknowledge route', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const headers = authHeaders(user.accessToken);
            const fixture = await seedCommerceFixture(server, headers);
            const order = await createOrder(server, headers, fixture, 'sc-ce-ack-header');
            await setOrderToNew(app.infra.database, tenantId, order.id);
            const orderExternalId = await findCompatExternalId(
                app,
                tenantId,
                ExternalIdMappingResourceType.ORDER,
                order.id,
            );
            const apiKey = await createOrdersUpdateApiKey(app, tenantId, user);
            const response = await server.inject({
                method: 'POST',
                url: `/api/v2/ce/orders/acknowledge?apiKey=${encodeURIComponent(apiKey.secret)}`,
                headers: { 'idempotency-key': 'sc-ce-explicit-key' },
                payload: acknowledgePayload(order.orderNumber, orderExternalId),
            });
            expect(response.statusCode).toBe(201);
        });
    });

    describe('query apiKey does not apply outside /api/v2/ce', () => {
        it('returns 401 for GET /api/v2/orders with only query apiKey', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const apiKey = await createOrdersReadApiKey(app, tenantId, user);
            const response = await server.inject({
                method: 'GET',
                url: `/api/v2/orders?apiKey=${encodeURIComponent(apiKey.secret)}`,
            });
            expect(response.statusCode).toBe(401);
        });

        it('still accepts header api key on GET /api/v2/orders', async () => {
            const { tenantId, slug } = await createTestTenant(server);
            const user = await createAuthenticatedUser(app, tenantId, slug);
            const apiKey = await createOrdersReadApiKey(app, tenantId, user);
            const response = await server.inject({
                method: 'GET',
                url: '/api/v2/orders',
                headers: apiKeyHeaders(apiKey.secret),
            });
            expect(response.statusCode).toBe(200);
        });
    });
});
