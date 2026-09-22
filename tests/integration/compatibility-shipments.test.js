import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../src/shared/auth/rate-limit-policies.js';
import { compatibilityRateLimitSubject } from '../../src/shared/auth/compatibility-rate-limit-subject.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import {
    apiKeyHeaders,
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

describe('POST /api/v2/shipments integration', () => {
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

    it('returns 401 without credentials', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: { 'idempotency-key': 'ship-unauth' },
            payload: shipmentPayload('ORD-MISSING', 'SKU-MISSING', 1),
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 without shipments.create permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const headers = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-forbidden', 1);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(authHeaders(viewer.accessToken), 'ship-forbidden'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, 'MSN-FORBIDDEN'),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('shipments.create');
    });

    it('creates a partial shipment and updates order line shipped quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-partial', 5);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-partial-1'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, 'MSN-PARTIAL-1'),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({ Success: true, StatusCode: 201, Message: null });

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].shippedQuantity).toBe(2);

        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${order.id}`,
            headers,
        });
        expect(shipments.statusCode).toBe(200);
        expect(shipments.json().data.items).toHaveLength(1);
        expect(shipments.json().data.items[0].trackingNumber).toBe('TRACK-123');
        expect(shipments.json().data.items[0].carrier).toBe('DHL');
    });

    it('ships all remaining quantity and advances order status', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-full', 3);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-full-1'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 3, 'MSN-FULL-1'),
        });
        expect(response.statusCode).toBe(201);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].shippedQuantity).toBe(3);
        expect(getRes.json().data.status).toBe('SHIPPED');
    });

    it('rejects over-shipment without clamping', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-over', 2);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-over-1'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 5, 'MSN-OVER-1'),
        });
        expect(response.statusCode).toBe(422);
        expect(response.json().Success).toBe(false);
        expect(response.json().Message).not.toMatch(/postgres|sql/i);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].shippedQuantity).toBe(0);
    });

    it('returns 404 for unknown merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-not-found'),
            payload: shipmentPayload('DOES-NOT-EXIST', 'SKU-1', 1),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().Success).toBe(false);
    });

    it('returns 422 for cancelled order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-cancelled', 2);
        await app.infra.database.query(
            `UPDATE orders SET status = 'CANCELLED', cancelled_at = now() WHERE tenant_id = $1 AND id = $2`,
            [tenantId, order.id],
            { operation: 'test.set_cancelled' },
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-cancelled-1'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, 'MSN-CANCELLED-1'),
        });
        expect(response.statusCode).toBe(422);
        expect(response.json().Success).toBe(false);
    });

    it('replays identical idempotent requests', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-idem', 4);
        const idempotencyKey = 'ship-replay-key';
        const payload = shipmentPayload(order.orderNumber, fixture.merchantSku, 2, 'MSN-IDEM-1');

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, idempotencyKey),
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, idempotencyKey),
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json()).toEqual(first.json());

        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${order.id}`,
            headers,
        });
        expect(shipments.json().data.items).toHaveLength(1);
    });

    it('rejects the same idempotency key with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-conflict', 4);
        const idempotencyKey = 'ship-conflict-key';

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, idempotencyKey),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, 'MSN-A'),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, idempotencyKey),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, 'MSN-B'),
        });
        expect(conflict.statusCode).toBe(409);
    });

    it('isolates tenants', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const orderA = await createOrder(server, headersA, fixtureA, 'ship-tenant-a', 2);

        const crossTenant = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headersB, 'ship-cross-tenant'),
            payload: shipmentPayload(orderA.orderNumber, fixtureA.merchantSku, 1, 'MSN-CROSS'),
        });
        expect(crossTenant.statusCode).toBe(404);
    });

    it('works with API key authentication', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-api-key', 2);
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId,
            actorPermissions: ['roles.read'],
            membershipId: user.membershipId,
        });
        const apiKey = await app.apiKeys.useCases.createApiKey.execute({
            tenantId,
            actorId: user.userId,
            actorPermissions: permissions.permissions,
            name: 'Shipment integration key',
            scopes: ['shipments.create'],
        });

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'ship-api-key-req',
            },
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 1, 'MSN-API-KEY'),
        });
        expect(response.statusCode).toBe(201);
    });

    it('prevents concurrent shipments from exceeding remaining quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-concurrent', 4);

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/shipments',
                headers: shipmentHeaders(headers, 'ship-concurrent-a'),
                payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 3, 'MSN-CONCURRENT-A'),
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/shipments',
                headers: shipmentHeaders(headers, 'ship-concurrent-b'),
                payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 3, 'MSN-CONCURRENT-B'),
            }),
        ]);

        const successCount = [responseA, responseB].filter((result) => result.statusCode === 201).length;
        expect(successCount).toBeLessThanOrEqual(1);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].shippedQuantity).toBeLessThanOrEqual(4);
    });

    it('reuses the same shipment for duplicate MerchantShipmentNo with different idempotency keys', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-dup-ref', 4);
        const merchantShipmentNo = 'MSN-DUP-REF-1';
        const payload = shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-dup-ref-a'),
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-dup-ref-b'),
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);

        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${order.id}`,
            headers,
        });
        expect(shipments.json().data.items).toHaveLength(1);
        expect(shipments.json().data.items[0].externalReference).toBe(merchantShipmentNo);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].shippedQuantity).toBe(2);
    });

    it('rejects duplicate MerchantShipmentNo with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-dup-conflict', 4);
        const merchantShipmentNo = 'MSN-DUP-CONFLICT-1';

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-dup-conflict-a'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-dup-conflict-b'),
            payload: shipmentPayload(order.orderNumber, fixture.merchantSku, 3, merchantShipmentNo),
        });
        expect(conflict.statusCode).toBe(409);
        expect(conflict.json().Success).toBe(false);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].shippedQuantity).toBe(2);
    });

    it('prevents concurrent duplicate MerchantShipmentNo from creating two shipments', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ship-dup-concurrent', 4);
        const merchantShipmentNo = 'MSN-DUP-CONCURRENT-1';
        const payload = shipmentPayload(order.orderNumber, fixture.merchantSku, 2, merchantShipmentNo);

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/shipments',
                headers: shipmentHeaders(headers, 'ship-dup-concurrent-a'),
                payload,
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/shipments',
                headers: shipmentHeaders(headers, 'ship-dup-concurrent-b'),
                payload,
            }),
        ]);

        expect(responseA.statusCode).toBe(201);
        expect(responseB.statusCode).toBe(201);

        const shipments = await server.inject({
            method: 'GET',
            url: `/api/v1/shipments?orderId=${order.id}`,
            headers,
        });
        expect(shipments.json().data.items).toHaveLength(1);
        expect(shipments.json().data.items[0].externalReference).toBe(merchantShipmentNo);
        expect(shipments.json().data.items[0].trackingNumber).toBe('TRACK-123');
    });

    it('applies mutation rate limiting', async () => {
        const infra = await getTestInfrastructure();
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const subject = compatibilityRateLimitSubject({
            tenantId,
            userId: user.userId,
        }, 'mutation');
        await infra.rateLimiter.reset({
            policy: COMPATIBILITY_RATE_LIMIT_POLICIES.mutation,
            subject,
        });
        for (let attempt = 0; attempt < COMPATIBILITY_RATE_LIMIT_POLICIES.mutation.limit; attempt += 1) {
            await infra.rateLimiter.consume({
                policy: COMPATIBILITY_RATE_LIMIT_POLICIES.mutation,
                subject,
            });
        }
        const headers = authHeaders(user.accessToken);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/shipments',
            headers: shipmentHeaders(headers, 'ship-rate-limited'),
            payload: shipmentPayload('ORD-RATE-LIMIT', 'SKU-1', 1),
        });
        expect(response.statusCode).toBe(429);
    });
});
