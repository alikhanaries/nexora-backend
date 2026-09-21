import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
async function seedAndCreateOrder(server, headers) {
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: `mp_${Date.now()}`, name: 'Idempotency Marketplace' },
    });
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId: marketplaceRes.json().data.id, name: 'Idempotency Channel' },
    });
    const productRes = await server.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers,
        payload: { merchantSku: `SKU-${Date.now()}`, productType: 'STANDARD' },
    });
    const locationRes = await server.inject({
        method: 'POST',
        url: '/api/v1/stock-locations',
        headers,
        payload: { name: 'Idempotency Warehouse' },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/inventory/receipts',
        headers,
        payload: {
            stockLocationId: locationRes.json().data.id,
            productId: productRes.json().data.id,
            quantity: 20,
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
            amountMinor: 1500,
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
    const orderRes = await server.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: { ...headers, 'idempotency-key': `order-${Date.now()}` },
        payload: {
            channelId: channelRes.json().data.id,
            currency: 'USD',
            lines: [{
                productId: productRes.json().data.id,
                stockLocationId: locationRes.json().data.id,
                quantity: 4,
            }],
        },
    });
    return {
        orderId: orderRes.json().data.id,
        orderLineId: orderRes.json().data.lines[0].id,
    };
}
describe('phase 4 mutation idempotency integration', () => {
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
    it('replays shipment creation with the same idempotency key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { orderId, orderLineId } = await seedAndCreateOrder(server, headers);
        const idempotencyKey = `shipment-${Date.now()}`;
        const payload = { lines: [{ orderLineId, quantity: 2 }] };
        const first = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().data.id).toBe(first.json().data.id);
    });
    it('replays cancellation creation with the same idempotency key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { orderId, orderLineId } = await seedAndCreateOrder(server, headers);
        const idempotencyKey = `cancellation-${Date.now()}`;
        const payload = {
            orderId,
            lines: [{ orderLineId, quantity: 1 }],
        };
        const first = await server.inject({
            method: 'POST',
            url: '/api/v1/cancellations',
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v1/cancellations',
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().data.id).toBe(first.json().data.id);
    });
    it('replays return creation with the same idempotency key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { orderId, orderLineId } = await seedAndCreateOrder(server, headers);
        await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': `ship-${Date.now()}` },
            payload: { lines: [{ orderLineId, quantity: 2 }] },
        });
        const idempotencyKey = `return-${Date.now()}`;
        const payload = { lines: [{ orderLineId, quantity: 1 }] };
        const first = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/returns`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/returns`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().data.id).toBe(first.json().data.id);
    });
    it('persists exactly one shipment for concurrent requests with the same idempotency key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { orderId, orderLineId } = await seedAndCreateOrder(server, headers);
        const idempotencyKey = `shipment-concurrent-${Date.now()}`;
        const payload = { lines: [{ orderLineId, quantity: 2 }] };
        const results = await Promise.all([
            server.inject({
                method: 'POST',
                url: `/api/v1/orders/${orderId}/shipments`,
                headers: { ...headers, 'idempotency-key': idempotencyKey },
                payload,
            }),
            server.inject({
                method: 'POST',
                url: `/api/v1/orders/${orderId}/shipments`,
                headers: { ...headers, 'idempotency-key': idempotencyKey },
                payload,
            }),
        ]);
        const successResponses = results.filter((result) => result.statusCode === 201);
        const inProgressResponses = results.filter((result) => result.statusCode === 409
            && result.json().error?.code === 'IDEMPOTENT_REQUEST_IN_PROGRESS');
        expect(successResponses.length + inProgressResponses.length).toBe(2);
        expect(successResponses.length).toBeGreaterThanOrEqual(1);
        if (successResponses.length === 2) {
            expect(successResponses[0].json().data.id).toBe(successResponses[1].json().data.id);
        }
        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${orderId}`,
            headers,
        });
        expect(shipments.statusCode).toBe(200);
        expect(shipments.json().data.items).toHaveLength(1);
        const order = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${orderId}`,
            headers,
        });
        expect(order.json().data.lines[0].shippedQuantity).toBe(2);
    });
    it('rejects idempotency key reuse with a different shipment payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { orderId, orderLineId } = await seedAndCreateOrder(server, headers);
        const idempotencyKey = `shipment-conflict-${Date.now()}`;
        const first = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload: { lines: [{ orderLineId, quantity: 1 }] },
        });
        expect(first.statusCode).toBe(201);
        const second = await server.inject({
            method: 'POST',
            url: `/api/v1/orders/${orderId}/shipments`,
            headers: { ...headers, 'idempotency-key': idempotencyKey },
            payload: { lines: [{ orderLineId, quantity: 2 }] },
        });
        expect(second.statusCode).toBe(409);
    });
});
