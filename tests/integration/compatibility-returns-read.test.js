import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createAuthenticatedUserWithSystemRole,
    createTestTenant,
} from './auth-helpers.js';
import {
    createOrder,
    returnHeaders,
    returnPayload,
    seedCommerceFixture,
    shipOrderQuantity,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('GET /api/v2/returns merchant read integration', () => {
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

    async function createReturnForOrder(headers, fixture, order, merchantReturnNo, idempotencyKey) {
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, order.lines[0].quantity, `ship-${idempotencyKey}`);
        await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, idempotencyKey),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, merchantReturnNo),
        });
    }

    it('returns 401 without credentials for merchant list', async () => {
        const response = await server.inject({ method: 'GET', url: '/api/v2/returns/merchant' });
        expect(response.statusCode).toBe(401);
    });

    it('returns 403 when the principal lacks returns.read', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const auditor = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'auditor');
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/returns/merchant',
            headers: authHeaders(auditor.accessToken),
        });
        expect(response.statusCode).toBe(403);
    });

    it('lists tenant returns with external reference and IN_PROGRESS status mapping', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-read-list', 2);
        const merchantReturnNo = 'MRN-READ-LIST';
        await createReturnForOrder(headers, fixture, order, merchantReturnNo, 'return-read-list-create');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/returns/merchant',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const entry = response.json().Content.find((item) => item.MerchantReturnNo === merchantReturnNo);
        expect(entry).toMatchObject({
            MerchantOrderNo: order.orderNumber,
            Status: 'IN_PROGRESS',
        });
        expect(entry.Id).toEqual(expect.any(Number));
    });

    it('lists new returns using IN_PROGRESS semantics', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-read-new', 2);
        const merchantReturnNo = 'MRN-READ-NEW';
        await createReturnForOrder(headers, fixture, order, merchantReturnNo, 'return-read-new-create');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/returns/merchant/new',
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().Content.some((item) => item.MerchantReturnNo === merchantReturnNo)).toBe(true);
    });

    it('returns returns for a merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-read-by-order', 3);
        const merchantReturnNo = 'MRN-BY-ORDER';
        await createReturnForOrder(headers, fixture, order, merchantReturnNo, 'return-read-by-order-create');

        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/returns/merchant/${encodeURIComponent(order.orderNumber)}`,
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().Content.some((item) => item.MerchantReturnNo === merchantReturnNo)).toBe(true);
    });

    it('returns 404 for unknown merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/returns/merchant/ORD-DOES-NOT-EXIST',
            headers: authHeaders(user.accessToken),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 404 });
    });

    it('isolates tenants on list and single-order endpoints', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const fixtureB = await seedCommerceFixture(server, headersB);
        const orderA = await createOrder(server, headersA, fixtureA, 'return-read-a', 2);
        const orderB = await createOrder(server, headersB, fixtureB, 'return-read-b', 2);
        await createReturnForOrder(headersA, fixtureA, orderA, 'MRN-TENANT-A', 'return-read-a-create');
        await createReturnForOrder(headersB, fixtureB, orderB, 'MRN-TENANT-B', 'return-read-b-create');

        const listA = await server.inject({ method: 'GET', url: '/api/v2/returns/merchant', headers: headersA });
        const listB = await server.inject({ method: 'GET', url: '/api/v2/returns/merchant', headers: headersB });
        const returnNosA = listA.json().Content.map((entry) => entry.MerchantReturnNo);
        expect(returnNosA).toContain('MRN-TENANT-A');
        expect(returnNosA).not.toContain('MRN-TENANT-B');
        expect(listB.json().Content.map((entry) => entry.MerchantReturnNo)).toContain('MRN-TENANT-B');

        const crossTenantLookup = await server.inject({
            method: 'GET',
            url: `/api/v2/returns/merchant/${encodeURIComponent(orderB.orderNumber)}`,
            headers: headersA,
        });
        expect(crossTenantLookup.statusCode).toBe(200);
        expect(crossTenantLookup.json().Content.some((item) => item.MerchantReturnNo === 'MRN-TENANT-B')).toBe(false);
    });

    it('returns empty results for unmapped external return statuses', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-read-status', 2);
        await createReturnForOrder(headers, fixture, order, 'MRN-STATUS', 'return-read-status-create');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/returns/merchant?Statuses=AUTO_CLOSED',
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ Count: 0, TotalCount: 0, Content: [] });
    });
});
