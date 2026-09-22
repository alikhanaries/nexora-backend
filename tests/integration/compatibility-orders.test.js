import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createAuthenticatedUserWithSystemRole, createTestTenant, } from './auth-helpers.js';
import { createOrder, seedCommerceFixture, setOrderStatus } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('GET /api/v2/orders integration', () => {
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

    it('returns 401 without credentials', async () => {
        const response = await server.inject({ method: 'GET', url: '/api/v2/orders' });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 when the principal lacks orders.read', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'auditor');
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders',
            headers: authHeaders(user.accessToken),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 403 });
    });

    it('returns tenant orders for an authenticated principal', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'list-all-1');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.Content.some((entry) => entry.MerchantOrderNo === order.orderNumber)).toBe(true);
        expect(body.Content[0].Status).toBe('IN_PROGRESS');
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
        await createOrder(server, headersA, fixtureA, 'tenant-a-list');
        await createOrder(server, headersB, fixtureB, 'tenant-b-list');

        const responseA = await server.inject({ method: 'GET', url: '/api/v2/orders', headers: headersA });
        const responseB = await server.inject({ method: 'GET', url: '/api/v2/orders', headers: headersB });
        const channelOrderNosA = responseA.json().Content.map((entry) => entry.ChannelOrderNo);
        const channelOrderNosB = responseB.json().Content.map((entry) => entry.ChannelOrderNo);
        expect(channelOrderNosA).toContain('tenant-a-list');
        expect(channelOrderNosA).not.toContain('tenant-b-list');
        expect(channelOrderNosB).toContain('tenant-b-list');
        expect(channelOrderNosB).not.toContain('tenant-a-list');
    });

    it('filters by external status without mapping CONFIRMED to NEW', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await createOrder(server, headers, fixture, 'confirmed-filter');
        const newOrder = await createOrder(server, headers, fixture, 'new-filter');
        await setOrderStatus(app.infra.database, tenantId, newOrder.id, 'NEW');

        const inProgress = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Statuses=IN_PROGRESS',
            headers,
        });
        const fresh = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Statuses=NEW',
            headers,
        });
        const inProgressNos = inProgress.json().Content.map((entry) => entry.ChannelOrderNo);
        const newNos = fresh.json().Content.map((entry) => entry.ChannelOrderNo);
        expect(inProgressNos).toContain('confirmed-filter');
        expect(inProgressNos).not.toContain('new-filter');
        expect(newNos).toContain('new-filter');
        expect(newNos).not.toContain('confirmed-filter');
    });

    it('filters by MerchantOrderNos and ChannelOrderNos', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'channel-ref-42');

        const byMerchant = await server.inject({
            method: 'GET',
            url: `/api/v2/orders?MerchantOrderNos=${encodeURIComponent(order.orderNumber)}`,
            headers,
        });
        const byChannel = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?ChannelOrderNos=channel-ref-42',
            headers,
        });
        expect(byMerchant.json().Content).toHaveLength(1);
        expect(byChannel.json().Content).toHaveLength(1);
        expect(byMerchant.json().Content[0].MerchantOrderNo).toBe(order.orderNumber);
        expect(byChannel.json().Content[0].ChannelOrderNo).toBe('channel-ref-42');
    });

    it('returns empty results for unmapped external statuses', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await createOrder(server, headers, fixture, 'awaiting-payment-filter');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Statuses=AWAITING_PAYMENT',
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            Success: true,
            Count: 0,
            TotalCount: 0,
            Content: [],
        });
    });

    it('paginates and preserves total count semantics', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        for (let index = 0; index < 3; index += 1) {
            await createOrder(server, headers, fixture, `page-order-${index}`);
        }

        const pageOne = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Page=1&ItemsPerPage=2',
            headers,
        });
        const pageTwo = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Page=2&ItemsPerPage=2',
            headers,
        });
        const beyondLast = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Page=99&ItemsPerPage=10',
            headers,
        });
        expect(pageOne.json().Count).toBe(2);
        expect(pageOne.json().ItemsPerPage).toBe(2);
        expect(pageOne.json().TotalCount).toBeGreaterThanOrEqual(3);
        expect(pageTwo.json().Count).toBeGreaterThanOrEqual(1);
        expect(beyondLast.json()).toMatchObject({ Count: 0, Content: [] });
    });

    it('filters by created-at date range', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await createOrder(server, headers, fixture, 'date-filter-order');
        const future = encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString());

        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/orders?FromCreatedAtDate=${future}`,
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ Count: 0, TotalCount: 0, Content: [] });
    });

    it('maps validation errors to the external envelope', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders?Page=0',
            headers: authHeaders(user.accessToken),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
            Success: false,
            StatusCode: 400,
            Message: expect.any(String),
        });
    });
});
