import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { createOrder, seedCommerceFixture, setOrderStatus } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('GET /api/v2/orders/new integration', () => {
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
        const response = await server.inject({ method: 'GET', url: '/api/v2/orders/new' });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({
            Success: false,
            StatusCode: 401,
        });
    });

    it('returns only NEW orders for the authenticated tenant', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const newOrder = await createOrder(server, headers, fixture, 'ext-new-1');
        const confirmedOrder = await createOrder(server, headers, fixture, 'ext-confirmed-1');
        await setOrderStatus(app.infra.database, tenantId, newOrder.id, 'NEW');
        await setOrderStatus(app.infra.database, tenantId, confirmedOrder.id, 'CONFIRMED');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.Content).toHaveLength(1);
        expect(body.Content[0].MerchantOrderNo).toBe(newOrder.orderNumber);
        expect(body.Content[0].Status).toBe('NEW');
        expect(body.Content[0].ChannelOrderNo).toBe('ext-new-1');
        expect(body.Content[0].Email).toBe('customer@example.com');
        expect(body.Content[0].CurrencyCode).toBe('USD');
        expect(body.Content[0].Lines?.[0]?.ChannelProductNo).toBeTruthy();
        expect(body.Content[0].Id).toEqual(expect.any(Number));
        expect(body.Content[0].tenantId).toBeUndefined();
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
        const orderA = await createOrder(server, headersA, fixtureA, 'tenant-a-order');
        const orderB = await createOrder(server, headersB, fixtureB, 'tenant-b-order');
        await setOrderStatus(app.infra.database, tenantA.tenantId, orderA.id, 'NEW');
        await setOrderStatus(app.infra.database, tenantB.tenantId, orderB.id, 'NEW');

        const responseA = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers: headersA,
        });
        const responseB = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers: headersB,
        });
        expect(responseA.statusCode).toBe(200);
        expect(responseB.statusCode).toBe(200);
        const channelOrderNosA = responseA.json().Content.map((order) => order.ChannelOrderNo);
        const channelOrderNosB = responseB.json().Content.map((order) => order.ChannelOrderNo);
        expect(channelOrderNosA).toContain('tenant-a-order');
        expect(channelOrderNosA).not.toContain('tenant-b-order');
        expect(channelOrderNosB).toContain('tenant-b-order');
        expect(channelOrderNosB).not.toContain('tenant-a-order');
    });

    it('paginates results', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const createdOrders = [];
        for (let index = 0; index < 3; index += 1) {
            const order = await createOrder(server, headers, fixture, `paginated-${index}`);
            await setOrderStatus(app.infra.database, tenantId, order.id, 'NEW');
            createdOrders.push(order);
        }

        const pageOne = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new?Page=1&ItemsPerPage=2',
            headers,
        });
        const pageTwo = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new?Page=2&ItemsPerPage=2',
            headers,
        });
        expect(pageOne.statusCode).toBe(200);
        expect(pageTwo.statusCode).toBe(200);
        const firstBody = pageOne.json();
        const secondBody = pageTwo.json();
        expect(firstBody.TotalCount).toBeGreaterThanOrEqual(3);
        expect(firstBody.ItemsPerPage).toBe(2);
        expect(firstBody.Count).toBe(2);
        expect(secondBody.Count).toBeGreaterThanOrEqual(1);
        const combined = [...firstBody.Content, ...secondBody.Content].map((order) => order.MerchantOrderNo);
        for (const order of createdOrders) {
            expect(combined).toContain(order.orderNumber);
        }
    });

    it('returns an empty page when page exceeds available results', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'single-new-order');
        await setOrderStatus(app.infra.database, tenantId, order.id, 'NEW');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new?Page=99&ItemsPerPage=10',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.TotalCount).toBeGreaterThanOrEqual(1);
        expect(body.Count).toBe(0);
        expect(body.Content).toEqual([]);
        expect(body.ItemsPerPage).toBe(10);
    });

    it('maps validation errors to the external error envelope', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new?Page=0',
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
