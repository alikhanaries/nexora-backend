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
    cancellationHeaders,
    cancellationPayload,
    createOrder,
    seedCommerceFixture,
    setOrderStatus,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('POST /api/v2/cancellations integration', () => {
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
            url: '/api/v2/cancellations',
            headers: { 'idempotency-key': 'cancel-unauth' },
            payload: cancellationPayload('ORD-MISSING', 'SKU-MISSING', 1),
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 without cancellations.create permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const headers = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-forbidden', 1);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(authHeaders(viewer.accessToken), 'cancel-forbidden'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, 'MCN-FORBIDDEN'),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('cancellations.create');
    });

    it('creates a partial cancellation and updates order line cancelled quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-partial', 5);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-partial-1'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 2, 'MCN-PARTIAL-1'),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({ Success: true, StatusCode: 201, Message: null });

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBe(2);

        const cancellations = await server.inject({
            method: 'GET',
            url: `/api/v1/cancellations?orderId=${order.id}`,
            headers,
        });
        expect(cancellations.statusCode).toBe(200);
        expect(cancellations.json().data.items).toHaveLength(1);
    });

    it('creates a full cancellation and cancels the order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-full', 3);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-full-1'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 3, 'MCN-FULL-1'),
        });
        expect(response.statusCode).toBe(201);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBe(3);
        expect(getRes.json().data.status).toBe('CANCELLED');
    });

    it('rejects over-cancellation without clamping', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-over', 4);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-over-1'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 5, 'MCN-OVER-1'),
        });
        expect(response.statusCode).toBe(422);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBe(0);
    });

    it('returns 404 for unknown merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-missing-order'),
            payload: cancellationPayload('ORD-MISSING', 'SKU-MISSING', 1, 'MCN-MISSING-ORDER'),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().Success).toBe(false);
    });

    it('returns 422 for non-cancellable order status', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-shipped', 4);
        await setOrderStatus(app.infra.database, tenantId, order.id, 'SHIPPED');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-shipped-1'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, 'MCN-SHIPPED-1'),
        });
        expect(response.statusCode).toBe(422);
    });

    it('returns 422 when order is already fully cancelled', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-already', 2);
        await setOrderStatus(app.infra.database, tenantId, order.id, 'CANCELLED');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-already-1'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, 'MCN-ALREADY-1'),
        });
        expect(response.statusCode).toBe(422);
    });

    it('replays identical idempotent requests', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-idem', 4);
        const payload = cancellationPayload(order.orderNumber, fixture.merchantSku, 2, 'MCN-IDEM-1');
        const idemHeaders = cancellationHeaders(headers, 'cancel-idem-replay');

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: idemHeaders,
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: idemHeaders,
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json()).toEqual(first.json());

        const cancellations = await server.inject({
            method: 'GET',
            url: `/api/v1/cancellations?orderId=${order.id}`,
            headers,
        });
        expect(cancellations.json().data.items).toHaveLength(1);
    });

    it('rejects the same idempotency key with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-idem-conflict', 4);
        const idemHeaders = cancellationHeaders(headers, 'cancel-idem-conflict-key');

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: idemHeaders,
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 2, 'MCN-IDEM-A'),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: idemHeaders,
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 3, 'MCN-IDEM-B'),
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
        const orderA = await createOrder(server, headersA, fixtureA, 'cancel-tenant-a', 3);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headersB, 'cancel-tenant-b'),
            payload: cancellationPayload(orderA.orderNumber, fixtureA.merchantSku, 1, 'MCN-TENANT-B'),
        });
        expect(response.statusCode).toBe(404);
    });

    it('works with API key authentication', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-api-key', 2);
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId,
            actorPermissions: ['roles.read'],
            membershipId: user.membershipId,
        });
        const apiKey = await app.apiKeys.useCases.createApiKey.execute({
            tenantId,
            actorId: user.userId,
            actorPermissions: permissions.permissions,
            name: 'Cancellation integration key',
            scopes: ['cancellations.create'],
        });

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'cancel-api-key-req',
            },
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 1, 'MCN-API-KEY'),
        });
        expect(response.statusCode).toBe(201);
    });

    it('prevents concurrent cancellations from exceeding remaining quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-concurrent', 4);

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/cancellations',
                headers: cancellationHeaders(headers, 'cancel-concurrent-a'),
                payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 3, 'MCN-CONCURRENT-A'),
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/cancellations',
                headers: cancellationHeaders(headers, 'cancel-concurrent-b'),
                payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 3, 'MCN-CONCURRENT-B'),
            }),
        ]);

        const successCount = [responseA, responseB].filter((result) => result.statusCode === 201).length;
        expect(successCount).toBeLessThanOrEqual(1);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBeLessThanOrEqual(4);
    });

    it('reuses the same cancellation for duplicate MerchantCancellationNo with different idempotency keys', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-dup-replay', 4);
        const merchantCancellationNo = 'MCN-DUP-REPLAY-1';
        const payload = cancellationPayload(order.orderNumber, fixture.merchantSku, 2, merchantCancellationNo);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-dup-replay-a'),
            payload,
        });
        expect(first.statusCode).toBe(201);

        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-dup-replay-b'),
            payload,
        });
        expect(second.statusCode).toBe(201);

        const cancellations = await server.inject({
            method: 'GET',
            url: `/api/v1/cancellations?orderId=${order.id}`,
            headers,
        });
        expect(cancellations.json().data.items).toHaveLength(1);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBe(2);
    });

    it('rejects duplicate MerchantCancellationNo with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-dup-conflict', 4);
        const merchantCancellationNo = 'MCN-DUP-CONFLICT-1';

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-dup-conflict-a'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 2, merchantCancellationNo),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-dup-conflict-b'),
            payload: cancellationPayload(order.orderNumber, fixture.merchantSku, 3, merchantCancellationNo),
        });
        expect(conflict.statusCode).toBe(409);
        expect(conflict.json().Success).toBe(false);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBe(2);
    });

    it('prevents concurrent duplicate MerchantCancellationNo from creating two cancellations', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'cancel-dup-concurrent', 4);
        const merchantCancellationNo = 'MCN-DUP-CONCURRENT-1';
        const payload = cancellationPayload(order.orderNumber, fixture.merchantSku, 2, merchantCancellationNo);

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/cancellations',
                headers: cancellationHeaders(headers, 'cancel-dup-concurrent-a'),
                payload,
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/cancellations',
                headers: cancellationHeaders(headers, 'cancel-dup-concurrent-b'),
                payload,
            }),
        ]);

        expect(responseA.statusCode).toBe(201);
        expect(responseB.statusCode).toBe(201);

        const cancellations = await server.inject({
            method: 'GET',
            url: `/api/v1/cancellations?orderId=${order.id}`,
            headers,
        });
        expect(cancellations.json().data.items).toHaveLength(1);

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.lines[0].cancelledQuantity).toBe(2);
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
            url: '/api/v2/cancellations',
            headers: cancellationHeaders(headers, 'cancel-rate-limited'),
            payload: cancellationPayload('ORD-RATE-LIMIT', 'SKU-1', 1),
        });
        expect(response.statusCode).toBe(429);
    });
});
