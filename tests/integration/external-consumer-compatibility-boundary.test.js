import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { createOrder, seedCommerceFixture, setOrderStatus } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

/**
 * Proves an external consumer can read Nexora orders through the merchant compatibility
 * boundary without consumer-specific domain logic (generic tenant fixture).
 */
describe('external consumer compatibility boundary', () => {
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

    it('maps a Nexora order to the merchant external contract via /api/v2/orders/new', async () => {
        const { tenantId, slug } = await createTestTenant(server, `erp-alpha-${Date.now()}`);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ext-erp-order-ref');
        await setOrderStatus(app.infra.database, tenantId, order.id, 'NEW');

        const response = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        const row = body.Content.find((entry) => entry.ChannelOrderNo === 'ext-erp-order-ref');
        expect(row).toBeDefined();
        expect(row.MerchantOrderNo).toBe(order.orderNumber);
        expect(row.Status).toBe('NEW');
    });
});
