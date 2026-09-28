import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { createOrder, seedCommerceFixture } from './compatibility-helpers.js';
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
        name: 'StockConnect CE invoice key',
        scopes: ['orders.read'],
    });
}

describe('StockConnect CE order invoice', () => {
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
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/ce/orders/ORD-1/invoice',
        });
        expect(response.statusCode).toBe(401);
    });

    it('returns application/pdf for a tenant order by merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'sc-invoice-ext');
        const apiKey = await createOrdersReadApiKey(app, tenantId, user);
        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/orders/${encodeURIComponent(order.orderNumber)}/invoice?apiKey=${encodeURIComponent(apiKey.secret)}`,
            headers: { accept: 'application/pdf' },
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.rawPayload.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });

    it('returns 404 JSON envelope for unknown merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const apiKey = await createOrdersReadApiKey(app, tenantId, user);
        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/orders/does-not-exist/invoice?apiKey=${encodeURIComponent(apiKey.secret)}`,
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().Success).toBe(false);
    });

    it('isolates invoices by tenant', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const fixtureA = await seedCommerceFixture(server, authHeaders(userA.accessToken));
        const orderA = await createOrder(server, authHeaders(userA.accessToken), fixtureA, 'sc-invoice-a');
        const keyB = await createOrdersReadApiKey(app, tenantB.tenantId, userB);
        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/orders/${encodeURIComponent(orderA.orderNumber)}/invoice?apiKey=${encodeURIComponent(keyB.secret)}`,
        });
        expect(response.statusCode).toBe(404);
    });
});
