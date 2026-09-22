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
    seedCommerceFixture,
    shipmentHeaders,
    shipmentPayload,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('GET /api/v2/shipments/merchant integration', () => {
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
        const response = await server.inject({ method: 'GET', url: '/api/v2/shipments/merchant' });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 when the principal lacks shipments.read', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const auditor = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'auditor');
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/shipments/merchant',
            headers: authHeaders(auditor.accessToken),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 403 });
    });

    it('lists tenant shipments with external reference mapping', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-read-1', 2);
        const merchantShipmentNo = 'MSN-READ-1';
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-read-create'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo),
        });

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/shipments/merchant',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.Content.some((entry) => entry.MerchantShipmentNo === merchantShipmentNo)).toBe(true);
        const shipment = body.Content.find((entry) => entry.MerchantShipmentNo === merchantShipmentNo);
        expect(shipment.MerchantOrderNo).toBe(order.orderNumber);
        expect(shipment.Lines[0].MerchantProductNo).toBe(fixture.merchantSku);
        expect(shipment.Method).toBe('DHL');
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
        const orderA = await createOrder(server, headersA, fixtureA, 'ship-read-a', 1);
        const orderB = await createOrder(server, headersB, fixtureB, 'ship-read-b', 1);
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headersA, 'ship-read-a-create'),
            payload: shipmentPayload(orderA.orderNumber, fixtureA.merchantSku, 1, 'MSN-TENANT-A'),
        });
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headersB, 'ship-read-b-create'),
            payload: shipmentPayload(orderB.orderNumber, fixtureB.merchantSku, 1, 'MSN-TENANT-B'),
        });

        const responseA = await server.inject({ method: 'GET', url: '/api/v2/shipments/merchant', headers: headersA });
        const responseB = await server.inject({ method: 'GET', url: '/api/v2/shipments/merchant', headers: headersB });
        const shipmentNosA = responseA.json().Content.map((entry) => entry.MerchantShipmentNo);
        const shipmentNosB = responseB.json().Content.map((entry) => entry.MerchantShipmentNo);
        expect(shipmentNosA).toContain('MSN-TENANT-A');
        expect(shipmentNosA).not.toContain('MSN-TENANT-B');
        expect(shipmentNosB).toContain('MSN-TENANT-B');
        expect(shipmentNosB).not.toContain('MSN-TENANT-A');
    });

    it('filters by MerchantShipmentNos and MerchantOrderNos', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-read-filter', 1);
        const merchantShipmentNo = 'MSN-FILTER-1';
        await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-read-filter-create'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, merchantShipmentNo),
        });

        const byShipmentNo = await server.inject({
            method: 'GET',
            url: `/api/v2/shipments/merchant?MerchantShipmentNos=${encodeURIComponent(merchantShipmentNo)}`,
            headers,
        });
        const byOrderNo = await server.inject({
            method: 'GET',
            url: `/api/v2/shipments/merchant?MerchantOrderNos=${encodeURIComponent(order.orderNumber)}`,
            headers,
        });
        expect(byShipmentNo.json().Content).toHaveLength(1);
        expect(byOrderNo.json().Content.some((entry) => entry.MerchantShipmentNo === merchantShipmentNo)).toBe(true);
    });

    it('paginates results', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-read-page', 3);
        for (let index = 0; index < 2; index += 1) {
            await server.inject({
                method: 'POST',
                url: '/api/v2/shipments',
                headers: shipmentHeaders(headers, `ship-read-page-${index}`),
                payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, `MSN-PAGE-${index}`),
            });
        }

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/shipments/merchant?Page=1&ItemsPerPage=1',
            headers,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().Count).toBe(1);
        expect(response.json().TotalCount).toBeGreaterThanOrEqual(2);
        expect(response.json().ItemsPerPage).toBe(1);
    });

    it('maps invalid pagination to external validation errors', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/shipments/merchant?Page=0',
            headers: authHeaders(user.accessToken),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 400 });
    });
});
