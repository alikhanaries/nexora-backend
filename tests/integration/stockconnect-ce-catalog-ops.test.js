import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExternalIdMappingResourceType } from '../../src/modules/external-id-mapping/public/index.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import {
    createOrder,
    findCompatExternalId,
    seedCommerceFixture,
    shipmentPayload,
} from './compatibility-helpers.js';
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
        name: 'StockConnect CE catalog ops key',
        scopes,
    });
}

describe('StockConnect CE catalog ops (freeze/bulkdelete/extra-data/delivery)', () => {
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

    it('freezes and unfreezes via X-CE-KEY header', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const apiKey = await createCatalogApiKey(app, tenantId, user, [
            'products.read',
            'products.update',
            'offers.update',
            'offers.read',
        ]);

        const freeze = await server.inject({
            method: 'POST',
            url: '/api/v2/ce/products/freeze',
            headers: { 'x-ce-key': apiKey.secret },
            payload: [{
                MerchantProductNo: fixture.merchantSku,
                Action: 'FREEZE',
                Reason: 'test',
            }],
        });
        expect(freeze.statusCode).toBe(200);
        expect(freeze.json().Content[0].MutatedCount).toBeGreaterThanOrEqual(1);

        const unfreeze = await server.inject({
            method: 'POST',
            url: '/api/v2/ce/products/freeze',
            headers: { 'x-ce-key': apiKey.secret },
            payload: [{
                MerchantProductNo: fixture.merchantSku,
                Action: 'UNFREEZE',
            }],
        });
        expect(unfreeze.statusCode).toBe(200);
        expect(unfreeze.json().Content[0].MutatedCount).toBeGreaterThanOrEqual(1);
    });

    it('bulk deletes products and patches extra-data', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const apiKey = await createCatalogApiKey(app, tenantId, user, [
            'products.create',
            'products.read',
            'products.update',
            'channels.read',
        ]);

        const extra = await server.inject({
            method: 'PATCH',
            url: `/api/v2/ce/products/extra-data/bulk?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload: [{
                MerchantProductNo: fixture.merchantSku,
                Operations: [
                    { Op: 'replace', Key: 'MarketPlace', Value: 'noon' },
                    { Op: 'replace', Key: 'noonPrice', Value: 12.5 },
                ],
            }],
        });
        expect(extra.statusCode).toBe(200);
        expect(extra.json().Content[0].Applied).toBe(2);

        const content = await server.inject({
            method: 'GET',
            url: `/api/v1/products/${fixture.productId}/content?locale=en`,
            headers,
        });
        expect(content.statusCode).toBe(200);
        expect(content.json().data[0].attributes.MarketPlace).toBe('noon');

        const deleted = await server.inject({
            method: 'POST',
            url: `/api/v2/ce/products/bulkdelete?apiKey=${encodeURIComponent(apiKey.secret)}`,
            payload: [fixture.merchantSku],
        });
        expect(deleted.statusCode).toBe(200);
        expect(deleted.json().Content[0].Deleted).toBe(true);
    });

    it('marks shipment delivered via delivery-state', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `sc-ce-del-${Date.now()}`);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const merchantShipmentNo = `CE-SHIP-${Date.now()}`;
        const shipKey = await createCatalogApiKey(app, tenantId, user, [
            'orders.read',
            'shipments.create',
            'shipments.update',
            'shipments.read',
        ]);
        const created = await server.inject({
            method: 'POST',
            url: `/api/v2/ce/shipments?apiKey=${encodeURIComponent(shipKey.secret)}`,
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, merchantShipmentNo),
        });
        expect(created.statusCode).toBe(201);

        const delivered = await server.inject({
            method: 'PUT',
            url: `/api/v2/ce/shipments/${encodeURIComponent(merchantShipmentNo)}/delivery-state?apikey=${encodeURIComponent(shipKey.secret)}`,
            payload: {
                Status: 'DELIVERED',
                DeliveredAt: new Date().toISOString(),
            },
        });
        expect(delivered.statusCode).toBe(200);
        expect(delivered.json().Content.Applied).toBe(true);
        expect(delivered.json().Content.Status).toBe('DELIVERED');
        expect(orderExternalId).toBeTypeOf('number');
    });
});
