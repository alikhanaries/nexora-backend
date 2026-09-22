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

describe('PUT /api/v2/shipments/:merchantShipmentNo integration', () => {
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

    async function createMerchantShipment(headers, fixture, orderNumber, merchantShipmentNo) {
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, `create-${merchantShipmentNo}`),
            payload: shipmentPayload(orderNumber, fixture.merchantSku, 1, merchantShipmentNo),
        });
        expect(response.statusCode).toBe(201);
        return merchantShipmentNo;
    }

    it('returns 401 without credentials', async () => {
        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/shipments/MSN-UNAUTH',
            headers: { 'idempotency-key': 'ship-track-unauth' },
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-1' },
        });
        expect(response.statusCode).toBe(401);
    });

    it('returns 403 without shipments.update permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const headers = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'track-forbidden', 1);
        const merchantShipmentNo = await createMerchantShipment(headers, fixture, order.orderNumber, 'MSN-TRACK-FORBIDDEN');

        const response = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: shipmentHeaders(authHeaders(viewer.accessToken), 'track-forbidden'),
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-FORBIDDEN' },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('shipments.update');
    });

    it('updates tracking and ships a CREATED merchant shipment', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'track-happy', 1);
        const merchantShipmentNo = await createMerchantShipment(headers, fixture, order.orderNumber, 'MSN-TRACK-HAPPY');

        const response = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: shipmentHeaders(headers, 'track-happy-1'),
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-HAPPY-1' },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ Success: true, StatusCode: 200, Message: null });

        const listRes = await server.inject({
            method: 'GET',
            url: `/api/v2/shipments/merchant?MerchantShipmentNos=${encodeURIComponent(merchantShipmentNo)}`,
            headers,
        });
        const shipment = listRes.json().Content[0];
        expect(shipment.Method).toBe('DHL');
        expect(shipment.TrackTraceNo).toBe('TRACK-HAPPY-1');
        expect(shipment.ShipmentDate).not.toBeNull();
    });

    it('replays safely with the same Idempotency-Key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'track-idem', 1);
        const merchantShipmentNo = await createMerchantShipment(headers, fixture, order.orderNumber, 'MSN-TRACK-IDEM');
        const requestHeaders = shipmentHeaders(headers, 'track-idem');
        const payload = { Method: 'UPS', TrackTraceNo: 'TRACK-IDEM-1' };

        const first = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: requestHeaders,
            payload,
        });
        const second = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: requestHeaders,
            payload,
        });
        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
    });

    it('returns 409 for the same Idempotency-Key with a conflicting payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'track-conflict', 1);
        const merchantShipmentNo = await createMerchantShipment(headers, fixture, order.orderNumber, 'MSN-TRACK-CONFLICT');
        const requestHeaders = shipmentHeaders(headers, 'track-conflict');

        await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: requestHeaders,
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-A' },
        });
        const second = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: requestHeaders,
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-B' },
        });
        expect(second.statusCode).toBe(409);
    });

    it('returns 404 for an unknown merchant shipment number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);

        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/shipments/MSN-MISSING',
            headers: shipmentHeaders(headers, 'track-missing'),
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-MISSING' },
        });
        expect(response.statusCode).toBe(404);
    });

    it('rejects cross-tenant shipment updates', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const order = await createOrder(server, headersA, fixtureA, 'track-cross', 1);
        const merchantShipmentNo = await createMerchantShipment(headersA, fixtureA, order.orderNumber, 'MSN-CROSS-TENANT');

        const response = await server.inject({
            method: 'PUT',
            url: `/api/v2/shipments/${merchantShipmentNo}`,
            headers: shipmentHeaders(headersB, 'track-cross-tenant'),
            payload: { Method: 'DHL', TrackTraceNo: 'TRACK-CROSS' },
        });
        expect(response.statusCode).toBe(404);
    });
});
