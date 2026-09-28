import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function createCatalogApiKey(app, tenantId, user, scopes) {
    const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
        tenantId,
        actorPermissions: ['roles.read'],
        membershipId: user.membershipId,
    });
    return app.apiKeys.useCases.createApiKey.execute({
        tenantId,
        actorId: user.userId,
        actorPermissions: permissions.permissions,
        name: 'StockConnect CE catalog key',
        scopes,
    });
}

describe('StockConnect CE catalog and channels (roadmap M2 P0)', () => {
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

    it('lists channels via GET /api/v2/ce/channels with query apiKey', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        await seedCommerceFixture(server, headers);
        const apiKey = await createCatalogApiKey(app, tenantId, user, ['channels.read']);
        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/ce/channels?apiKey=${encodeURIComponent(apiKey.secret)}`,
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.Content.length).toBeGreaterThanOrEqual(1);
        expect(body.Content[0].Channels[0].ChannelName).toBeTruthy();
    });

    it('upserts products via POST /api/v2/ce/products', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const apiKey = await createCatalogApiKey(app, tenantId, user, ['products.create', 'products.read']);
        const sku = `CE-SKU-${Date.now()}`;
        const first = await server.inject({
            method: 'POST',
            url: `/api/v2/ce/products?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload: [{ MerchantProductNo: sku, Name: 'CE Product' }],
        });
        expect(first.statusCode).toBe(200);
        expect(first.json().Content[0].MerchantProductNo).toBe(sku);
        const second = await server.inject({
            method: 'POST',
            url: `/api/v2/ce/products?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload: [{ MerchantProductNo: sku }],
        });
        expect(second.statusCode).toBe(200);
        expect(second.json().Content[0].ProductId).toBe(first.json().Content[0].ProductId);
    });

    it('updates offer stock and price', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: { defaultStockLocationId: fixture.stockLocationId },
        });
        const apiKey = await createCatalogApiKey(app, tenantId, user, [
            'products.create',
            'products.read',
            'channels.read',
        ]);
        const stock = await server.inject({
            method: 'PUT',
            url: `/api/v2/ce/offer/stock?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload: [{
                MerchantProductNo: fixture.merchantSku,
                StockLocations: [{ Stock: 42 }],
            }],
        });
        expect(stock.statusCode).toBe(200);
        const price = await server.inject({
            method: 'PUT',
            url: `/api/v2/ce/offer?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload: [{
                MerchantProductNo: fixture.merchantSku,
                Price: 19.5,
                CurrencyCode: 'USD',
            }],
        });
        expect(price.statusCode).toBe(200);
    });
});
