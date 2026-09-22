import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function seedCommerceFixture(server, headers) {
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: `mp_${Date.now()}`, name: 'Command Service Marketplace' },
    });
    expect(marketplaceRes.statusCode).toBe(201);
    const marketplaceId = marketplaceRes.json().data.id;
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId, name: 'Command Service Channel' },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const productRes = await server.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers,
        payload: { merchantSku: `SKU-${Date.now()}`, productType: 'STANDARD' },
    });
    expect(productRes.statusCode).toBe(201);
    const productId = productRes.json().data.id;
    const locationRes = await server.inject({
        method: 'POST',
        url: '/api/v1/stock-locations',
        headers,
        payload: { name: 'Command Service Warehouse' },
    });
    expect(locationRes.statusCode).toBe(201);
    const stockLocationId = locationRes.json().data.id;
    await server.inject({
        method: 'POST',
        url: '/api/v1/inventory/receipts',
        headers,
        payload: {
            stockLocationId,
            productId,
            quantity: 10,
            referenceType: 'TEST',
            referenceId: `receipt-${Date.now()}`,
        },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/prices',
        headers,
        payload: {
            productId,
            channelId,
            currency: 'USD',
            amountMinor: 1500,
        },
    });
    const offerRes = await server.inject({
        method: 'POST',
        url: '/api/v1/offers',
        headers,
        payload: { productId, channelId },
    });
    expect(offerRes.statusCode).toBe(201);
    const offerId = offerRes.json().data.id;
    await server.inject({
        method: 'POST',
        url: `/api/v1/offers/${offerId}/activate`,
        headers,
        payload: { requirePricing: true },
    });
    return { channelId, productId, stockLocationId };
}

describe('OrderCommandService integration', () => {
    let app;
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates an order through the public command boundary with tenant isolation and idempotency', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { channelId, productId, stockLocationId } = await seedCommerceFixture(server, headers);
        const roles = await app.authorization.useCases.listRoles.execute({
            tenantId,
            actorPermissions: ['tenant.admin', 'roles.read'],
        });
        const ownerRole = roles.find((role) => role.systemKey === 'owner');
        expect(ownerRole).toBeDefined();
        const idempotencyKey = `command-service-${Date.now()}`;
        const command = {
            tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: ownerRole.permissionKeys,
            channelId,
            currency: 'USD',
            lines: [{
                productId,
                stockLocationId,
                quantity: 2,
            }],
            externalOrderReference: 'EXT-001',
            customer: {
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'ada@example.com',
            },
            idempotencyKey,
            principalFingerprint: user.userId,
            requestFingerprint: JSON.stringify({ channelId, productId, quantity: 2 }),
        };

        const first = await app.orders.orderCommandService.createOrder(command);
        const second = await app.orders.orderCommandService.createOrder(command);

        expect(first.order.id).toBe(second.order.id);
        expect(first.order.tenantId).toBe(tenantId);
        expect(first.order.externalOrderReference).toBe('EXT-001');
        expect(first.order.lines).toHaveLength(1);
        expect(first.order.lines[0].quantity).toBe(2);
        expect(first.order.customer.firstName).toBe('Ada');
        expect(first.order).not.toHaveProperty('rows');
    });
});
