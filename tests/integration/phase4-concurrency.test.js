import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
async function seedCommerceFixture(server, headers) {
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: `mp_${Date.now()}`, name: 'Concurrency Marketplace' },
    });
    expect(marketplaceRes.statusCode).toBe(201);
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId: marketplaceRes.json().data.id, name: 'Concurrency Channel' },
    });
    expect(channelRes.statusCode).toBe(201);
    const productRes = await server.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers,
        payload: { merchantSku: `SKU-${Date.now()}`, productType: 'STANDARD' },
    });
    expect(productRes.statusCode).toBe(201);
    const locationRes = await server.inject({
        method: 'POST',
        url: '/api/v1/stock-locations',
        headers,
        payload: { name: 'Concurrency Warehouse' },
    });
    expect(locationRes.statusCode).toBe(201);
    await server.inject({
        method: 'POST',
        url: '/api/v1/inventory/receipts',
        headers,
        payload: {
            stockLocationId: locationRes.json().data.id,
            productId: productRes.json().data.id,
            quantity: 100,
            referenceType: 'TEST',
            referenceId: `receipt-${Date.now()}`,
        },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/prices',
        headers,
        payload: {
            productId: productRes.json().data.id,
            channelId: channelRes.json().data.id,
            currency: 'USD',
            amountMinor: 1000,
        },
    });
    const offerRes = await server.inject({
        method: 'POST',
        url: '/api/v1/offers',
        headers,
        payload: {
            productId: productRes.json().data.id,
            channelId: channelRes.json().data.id,
        },
    });
    await server.inject({
        method: 'POST',
        url: `/api/v1/offers/${offerRes.json().data.id}/activate`,
        headers,
        payload: { requirePricing: true },
    });
    return {
        channelId: channelRes.json().data.id,
        productId: productRes.json().data.id,
        stockLocationId: locationRes.json().data.id,
    };
}
async function createOrder(server, headers, fixture, quantity) {
    const response = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: {
            ...headers,
            'idempotency-key': `order-${Date.now()}-${Math.random()}`,
        },
        payload: {
            channelId: fixture.channelId,
            currency: 'USD',
            lines: [{
                productId: fixture.productId,
                stockLocationId: fixture.stockLocationId,
                quantity,
            }],
        },
    });
    expect(response.statusCode).toBe(201);
    const order = response.json().data;
    return {
        orderId: order.id,
        orderLineId: order.lines[0].id,
    };
}
describe('phase 4 concurrency integration', () => {
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
    it('prevents concurrent shipments from exceeding ordered quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const { orderId, orderLineId } = await createOrder(server, headers, fixture, 5);
        const payload = {
            lines: [{ orderLineId, quantity: 3 }],
        };
        const results = await Promise.all([
            server.inject({
                method: 'POST',
                url: `/api/v1/orders/${orderId}/shipments`,
                headers: { ...headers, 'idempotency-key': `ship-a-${Date.now()}` },
                payload,
            }),
            server.inject({
                method: 'POST',
                url: `/api/v1/orders/${orderId}/shipments`,
                headers: { ...headers, 'idempotency-key': `ship-b-${Date.now()}` },
                payload,
            }),
        ]);
        const successCount = results.filter((result) => result.statusCode === 201).length;
        expect(successCount).toBeLessThanOrEqual(1);
        const order = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${orderId}`,
            headers,
        });
        expect(order.json().data.lines[0].shippedQuantity).toBeLessThanOrEqual(5);
    });
    it('prevents concurrent cancellations from exceeding cancellable quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const { orderId, orderLineId } = await createOrder(server, headers, fixture, 5);
        const payload = {
            orderId,
            lines: [{ orderLineId, quantity: 3 }],
        };
        const results = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v1/cancellations',
                headers: { ...headers, 'idempotency-key': `cancel-a-${Date.now()}` },
                payload,
            }),
            server.inject({
                method: 'POST',
                url: '/api/v1/cancellations',
                headers: { ...headers, 'idempotency-key': `cancel-b-${Date.now()}` },
                payload,
            }),
        ]);
        const successCount = results.filter((result) => result.statusCode === 201).length;
        expect(successCount).toBeLessThanOrEqual(1);
        const order = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${orderId}`,
            headers,
        });
        expect(order.json().data.lines[0].cancelledQuantity).toBeLessThanOrEqual(5);
    });
    it('prevents concurrent returns from exceeding eligible shipped quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const { orderId, orderLineId } = await createOrder(server, headers, fixture, 5);
        const shipRes = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': `ship-${Date.now()}` },
            payload: { lines: [{ orderLineId, quantity: 5 }] },
        });
        expect(shipRes.statusCode).toBe(201);
        const payload = {
            lines: [{ orderLineId, quantity: 3 }],
        };
        const results = await Promise.all([
            server.inject({
                method: 'POST',
                url: `/api/v1/orders/${orderId}/returns`,
                headers: { ...headers, 'idempotency-key': `return-a-${Date.now()}` },
                payload,
            }),
            server.inject({
                method: 'POST',
                url: `/api/v1/orders/${orderId}/returns`,
                headers: { ...headers, 'idempotency-key': `return-b-${Date.now()}` },
                payload,
            }),
        ]);
        const successCount = results.filter((result) => result.statusCode === 201).length;
        expect(successCount).toBeLessThanOrEqual(1);
        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${orderId}`,
            headers,
        });
        const totalRequested = returns.json().data.items.reduce((sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0), 0);
        expect(totalRequested).toBeLessThanOrEqual(5);
    });
});
