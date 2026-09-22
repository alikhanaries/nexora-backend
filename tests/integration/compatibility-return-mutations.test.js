import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createAuthenticatedUserWithSystemRole,
    createTestTenant,
} from './auth-helpers.js';
import {
    acknowledgeReturnPayload,
    createOrder,
    receiveReturnPayload,
    returnHeaders,
    returnPayload,
    seedCommerceFixture,
    shipOrderQuantity,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('Merchant return acknowledge/receive integration', () => {
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

    async function createMerchantReturn(headers, fixture, orderNumber, merchantReturnNo, quantity = 1) {
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, `create-${merchantReturnNo}`),
            payload: returnPayload(orderNumber, fixture.merchantSku, quantity, merchantReturnNo),
        });
        expect(response.statusCode).toBe(201);
    }

    it('acknowledges a return by MerchantReturnNo', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-return', 2);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 2, 'ship-ack');
        const merchantReturnNo = 'MRN-ACK-1';
        await createMerchantReturn(headers, fixture, order.orderNumber, merchantReturnNo, 2);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns/merchant/acknowledge',
            headers: returnHeaders(headers, 'ack-return-1'),
            payload: acknowledgeReturnPayload(merchantReturnNo),
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ Success: true, StatusCode: 200, Message: null });

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items[0].status).toBe('APPROVED');
    });

    it('receives a return and restores inventory', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'receive-return', 2);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 2, 'ship-receive');
        const merchantReturnNo = 'MRN-RECEIVE-1';
        await createMerchantReturn(headers, fixture, order.orderNumber, merchantReturnNo, 2);

        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'receive-return-1'),
            payload: receiveReturnPayload(fixture.merchantSku, 2),
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ Success: true, StatusCode: 200, Message: null });

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items[0].status).toBe('RECEIVED');
    });

    it('returns 403 without returns.update permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const headers = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'receive-forbidden', 1);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 1, 'ship-receive-forbidden');
        await createMerchantReturn(headers, fixture, order.orderNumber, 'MRN-RECEIVE-FORBIDDEN');

        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/returns',
            headers: returnHeaders(authHeaders(viewer.accessToken), 'receive-forbidden'),
            payload: receiveReturnPayload(fixture.merchantSku, 1),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('returns.update');
    });

    it('rejects a return when all quantities are rejected', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'reject-return', 1);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 1, 'ship-reject');
        await createMerchantReturn(headers, fixture, order.orderNumber, 'MRN-REJECT-1');

        const response = await server.inject({
            method: 'PUT',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'reject-return-1'),
            payload: receiveReturnPayload(fixture.merchantSku, 1, 0, 1),
        });
        expect(response.statusCode).toBe(200);

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items[0].status).toBe('REJECTED');
    });

    it('replays acknowledge safely with the same Idempotency-Key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-idem', 1);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 1, 'ship-ack-idem');
        const merchantReturnNo = 'MRN-ACK-IDEM';
        await createMerchantReturn(headers, fixture, order.orderNumber, merchantReturnNo);
        const requestHeaders = returnHeaders(headers, 'ack-idem');
        const payload = acknowledgeReturnPayload(merchantReturnNo);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/returns/merchant/acknowledge',
            headers: requestHeaders,
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/returns/merchant/acknowledge',
            headers: requestHeaders,
            payload,
        });
        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
    });
});
