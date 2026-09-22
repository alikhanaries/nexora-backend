import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createAuthenticatedUserWithSystemRole,
    createTestTenant,
} from './auth-helpers.js';
import {
    cancellationHeaders,
    cancellationPayload,
    createOrder,
    seedCommerceFixture,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('GET /api/v2/cancellations/merchant integration', () => {
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
        const response = await server.inject({ method: 'GET', url: '/api/v2/cancellations/merchant' });
        expect(response.statusCode).toBe(401);
    });

    it('returns 403 when the principal lacks cancellations.read', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const auditor = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'auditor');
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/cancellations/merchant',
            headers: authHeaders(auditor.accessToken),
        });
        expect(response.statusCode).toBe(403);
    });

    it('lists tenant cancellations with external reference mapping', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-read-1', 2);
        const merchantCancellationNo = 'MCN-READ-1';
        await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-read-create'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, merchantCancellationNo),
        });

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/cancellations/merchant',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Content.some((entry) => entry.MerchantCancellationNo === merchantCancellationNo)).toBe(true);
        const cancellation = body.Content.find((entry) => entry.MerchantCancellationNo === merchantCancellationNo);
        expect(cancellation.MerchantOrderNo).toBe(order.orderNumber);
        expect(cancellation.Lines[0].Quantity).toBe(1);
        expect(cancellation.Id).toBeUndefined();
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
        const orderA = await createOrder(server, headersA, fixtureA, 'cancel-read-a', 1);
        const orderB = await createOrder(server, headersB, fixtureB, 'cancel-read-b', 1);
        await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headersA, 'cancel-read-a-create'),
            payload: cancellationPayload(orderA.orderNumber, fixtureA.merchantSku, 1, 'MCN-TENANT-A'),
        });
        await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headersB, 'cancel-read-b-create'),
            payload: cancellationPayload(orderB.orderNumber, fixtureB.merchantSku, 1, 'MCN-TENANT-B'),
        });

        const responseA = await server.inject({ method: 'GET', url: '/api/v2/cancellations/merchant', headers: headersA });
        const responseB = await server.inject({ method: 'GET', url: '/api/v2/cancellations/merchant', headers: headersB });
        const nosA = responseA.json().Content.map((entry) => entry.MerchantCancellationNo);
        const nosB = responseB.json().Content.map((entry) => entry.MerchantCancellationNo);
        expect(nosA).toContain('MCN-TENANT-A');
        expect(nosA).not.toContain('MCN-TENANT-B');
        expect(nosB).toContain('MCN-TENANT-B');
        expect(nosB).not.toContain('MCN-TENANT-A');
    });

    it('filters by MerchantCancellationNos', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-read-filter', 2);
        const merchantCancellationNo = 'MCN-FILTER-1';
        await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-read-filter-create'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, merchantCancellationNo),
        });

        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/cancellations/merchant?MerchantCancellationNos=${encodeURIComponent(merchantCancellationNo)}`,
            headers,
        });
        expect(response.json().Content).toHaveLength(1);
        expect(response.json().Content[0].MerchantCancellationNo).toBe(merchantCancellationNo);
    });
});
