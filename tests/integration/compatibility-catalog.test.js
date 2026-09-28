import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
    authHeaders,
    createAuthenticatedUser,
    createAuthenticatedUserWithSystemRole,
    createTestTenant,
} from './auth-helpers.js';
import { seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

function catalogHeaders(baseHeaders, idempotencyKey, channelExternalReference) {
    return {
        ...baseHeaders,
        'idempotency-key': idempotencyKey,
        ...(channelExternalReference === undefined
            ? {}
            : { 'x-channel-reference': channelExternalReference }),
    };
}

describe('CE catalog compatibility integration', () => {
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

    it('POST /api/v2/products creates product and GET returns CE shape', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const sku = `CE-SKU-${Date.now()}`;

        const postRes = await server.inject({
            method: 'POST',
            url: '/api/v2/products',
            headers: catalogHeaders(headers, 'ce-product-create-1'),
            payload: {
                MerchantProductNo: sku,
                Name: 'CE Product',
                ExtraData: { color: 'red' },
            },
        });
        expect(postRes.statusCode).toBe(200);
        expect(postRes.json()).toMatchObject({ Success: true });

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v2/products?merchantProductNoList=${encodeURIComponent(sku)}`,
            headers,
        });
        expect(getRes.statusCode).toBe(200);
        const body = getRes.json();
        expect(body.Success).toBe(true);
        expect(body.Content).toHaveLength(1);
        expect(body.Content[0]).toMatchObject({
            MerchantProductNo: sku,
            Name: 'CE Product',
            ExtraData: { color: 'red' },
        });
    });

    it('POST /api/v2/products/bulkdelete deactivates without removing history SKU', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);

        const delRes = await server.inject({
            method: 'POST',
            url: '/api/v2/products/bulkdelete',
            headers: catalogHeaders(headers, 'ce-bulkdelete-1'),
            payload: { MerchantProductNoList: [fixture.merchantSku] },
        });
        expect(delRes.statusCode).toBe(200);
        expect(delRes.json().Success).toBe(true);

        const nativeRes = await server.inject({
            method: 'GET',
            url: `/api/v1/products/${fixture.productId}`,
            headers,
        });
        expect(nativeRes.statusCode).toBe(200);
        expect(nativeRes.json().data.status).toBe('INACTIVE');
    });

    it('returns 403 for catalog read without products.read', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const headers = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, headers);

        const response = await server.inject({
            method: 'GET',
            url: `/api/v2/products?merchantProductNoList=${encodeURIComponent(fixture.merchantSku)}`,
            headers: authHeaders(viewer.accessToken),
        });
        expect(response.statusCode).toBe(403);
    });

    it('PUT /api/v2/offer updates price with channel reference', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelRef = `CH-${Date.now()}`;
        await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: {
                externalReference: channelRef,
                defaultStockLocationId: fixture.stockLocationId,
            },
        });

        const offerRes = await server.inject({
            method: 'PUT',
            url: '/api/v2/offer',
            headers: catalogHeaders(headers, 'ce-offer-price-1', channelRef),
            payload: {
                MerchantProductNo: fixture.merchantSku,
                Price: 19.99,
                CurrencyCode: 'USD',
            },
        });
        expect(offerRes.statusCode).toBe(200);
        expect(offerRes.json().Success).toBe(true);

        const pricesRes = await server.inject({
            method: 'GET',
            url: `/api/v1/prices?productId=${fixture.productId}&channelId=${fixture.channelId}`,
            headers,
        });
        expect(pricesRes.statusCode).toBe(200);
        const items = pricesRes.json().data.items;
        expect(items.some((p) => p.amountMinor === 1999)).toBe(true);
    });

    it('PUT /api/v2/offer/stock sets absolute inventory', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelRef = `CH-STOCK-${Date.now()}`;
        await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: {
                externalReference: channelRef,
                defaultStockLocationId: fixture.stockLocationId,
            },
        });

        const stockRes = await server.inject({
            method: 'PUT',
            url: '/api/v2/offer/stock',
            headers: catalogHeaders(headers, 'ce-offer-stock-1', channelRef),
            payload: {
                MerchantProductNo: fixture.merchantSku,
                Stock: 42,
            },
        });
        expect(stockRes.statusCode).toBe(200);
        expect(stockRes.json().Success).toBe(true);

        const invRes = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory?productId=${fixture.productId}&stockLocationId=${fixture.stockLocationId}`,
            headers,
        });
        expect(invRes.statusCode).toBe(200);
        expect(invRes.json().data.available).toBe(42);
    });

    it('replays idempotent POST /api/v2/products', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const sku = `CE-IDEM-${Date.now()}`;
        const mutationHeaders = catalogHeaders(headers, 'ce-idem-product');

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/products',
            headers: mutationHeaders,
            payload: { MerchantProductNo: sku, Name: 'Once' },
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/products',
            headers: mutationHeaders,
            payload: { MerchantProductNo: sku, Name: 'Once' },
        });
        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(second.json()).toEqual(first.json());
    });
});
