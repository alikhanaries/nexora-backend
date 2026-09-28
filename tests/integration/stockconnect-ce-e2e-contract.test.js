import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { ExternalIdMappingResourceType } from '../../src/modules/external-id-mapping/public/index.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import {
    acknowledgePayload,
    createOrder,
    findCompatExternalId,
    seedCommerceFixture,
    setOrderToNew,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function createApiKey(app, tenantId, user, scopes, name) {
    const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
        tenantId,
        actorPermissions: ['roles.read'],
        membershipId: user.membershipId,
    });
    return app.apiKeys.useCases.createApiKey.execute({
        tenantId,
        actorId: user.userId,
        actorPermissions: permissions.permissions,
        name,
        scopes,
    });
}

/** StockConnect order poll envelope fields (orderService.getNewOrders). */
const STOCKCONNECT_ORDER_FIELDS = [
    'ChannelOrderNo',
    'MerchantOrderNo',
    'Status',
    'Lines',
];

describe('StockConnect CE end-to-end contract verification', () => {
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

    it('GET /api/v2/ce/orders returns Content, TotalCount, ItemsPerPage (StockConnect poll)', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await createOrder(server, headers, fixture, 'sc-e2e-poll');
        const apiKey = await createApiKey(app, tenantId, user, ['orders.read'], 'CE poll');

        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/orders?page=1&pageSize=100&apiKey=${encodeURIComponent(apiKey.secret)}`,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(typeof body.TotalCount).toBe('number');
        expect(body.ItemsPerPage).toBe(100);
        expect(Array.isArray(body.Content)).toBe(true);
        const row = body.Content.find((entry) => entry.ChannelOrderNo === 'sc-e2e-poll');
        expect(row).toBeDefined();
        for (const field of STOCKCONNECT_ORDER_FIELDS) {
            expect(row).toHaveProperty(field);
        }
        expect(Array.isArray(row.Lines)).toBe(true);
        expect(row.Lines[0]).toHaveProperty('MerchantProductNo');
    });

    it('GET /api/v2/ce/products accepts repeated merchantProductNoList (ceService.js)', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const apiKey = await createApiKey(app, tenantId, user, ['products.read'], 'CE products GET');
        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/products?apiKey=${encodeURIComponent(apiKey.secret)}&merchantProductNoList=${encodeURIComponent(fixture.merchantSku)}`,
        });
        expect(response.statusCode, response.body).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.Content).toHaveLength(1);
        expect(body.Content[0].MerchantProductNo).toBe(fixture.merchantSku);
    });

    it('GET /api/v2/ce/channels/:channelId/products returns MerchantProductNo and ChannelStatus', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const ceChannelId = 4242;
        await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: {
                externalReference: String(ceChannelId),
                defaultStockLocationId: fixture.stockLocationId,
            },
        });
        const apiKey = await createApiKey(
            app,
            tenantId,
            user,
            ['products.read', 'offers.read'],
            'CE channel products',
        );

        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/channels/${ceChannelId}/products?page=1&pageSize=250&apiKey=${encodeURIComponent(apiKey.secret)}`,
        });
        expect(response.statusCode, response.body).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(typeof body.Count).toBe('number');
        const item = body.Content.find((row) => row.MerchantProductNo === fixture.merchantSku);
        expect(item).toBeDefined();
        expect(typeof item.ChannelStatus).toBe('string');
    });

    it('POST /api/v2/ce/orders/acknowledge accepts StockConnect payload without Idempotency-Key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'sc-e2e-ack');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const apiKey = await createApiKey(app, tenantId, user, ['orders.update'], 'CE ack');
        const payload = acknowledgePayload(order.orderNumber, orderExternalId);
        const response = await server.inject({
            method: 'POST',
            url: `/api/v2/ce/orders/acknowledge?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload,
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().Success).toBe(true);
    });
});
