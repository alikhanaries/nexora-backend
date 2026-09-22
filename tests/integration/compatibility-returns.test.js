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
    returnHeaders,
    returnPayload,
    seedCommerceFixture,
    shipOrderQuantity,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('POST /api/v2/returns integration', () => {
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
            url: '/api/v2/returns',
            headers: { 'idempotency-key': 'return-unauth' },
            payload: returnPayload('ORD-MISSING', 'SKU-MISSING', 1),
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 without returns.create permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');
        const headers = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-forbidden', 1);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 1, 'ship-forbidden');
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(authHeaders(viewer.accessToken), 'return-forbidden'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, 'MRN-FORBIDDEN'),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('returns.create');
    });

    it('creates a partial return after shipment', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-partial', 5);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 5, 'ship-partial');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-partial-1'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 2, 'MRN-PARTIAL-1'),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({ Success: true, StatusCode: 201, Message: null });

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items).toHaveLength(1);
        expect(returns.json().data.items[0].status).toBe('REQUESTED');
    });

    it('creates a full return for all shipped quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-full', 3);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 3, 'ship-full');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-full-1'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 3, 'MRN-FULL-1'),
        });
        expect(response.statusCode).toBe(201);
    });

    it('rejects over-return without clamping', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-over', 4);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 2, 'ship-over');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-over-1'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 3, 'MRN-OVER-1'),
        });
        expect(response.statusCode).toBe(422);

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items).toHaveLength(0);
    });

    it('returns 422 when nothing has been shipped', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-unshipped', 4);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-unshipped-1'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, 'MRN-UNSHIPPED-1'),
        });
        expect(response.statusCode).toBe(422);
    });

    it('returns 404 for unknown merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-missing-order'),
            payload: returnPayload('ORD-MISSING', 'SKU-MISSING', 1, 'MRN-MISSING-ORDER'),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().Success).toBe(false);
    });

    it('replays identical idempotent requests', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-idem', 4);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 4, 'ship-idem');
        const payload = returnPayload(order.orderNumber, fixture.merchantSku, 2, 'MRN-IDEM-1');
        const idemHeaders = returnHeaders(headers, 'return-idem-replay');

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: idemHeaders,
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: idemHeaders,
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json()).toEqual(first.json());

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items).toHaveLength(1);
    });

    it('rejects the same idempotency key with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-idem-conflict', 4);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 4, 'ship-idem-conflict');
        const idemHeaders = returnHeaders(headers, 'return-idem-conflict-key');

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: idemHeaders,
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 2, 'MRN-IDEM-A'),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: idemHeaders,
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 3, 'MRN-IDEM-B'),
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
        const orderA = await createOrder(server, headersA, fixtureA, 'return-tenant-a', 3);
        await shipOrderQuantity(server, headersA, orderA.id, orderA.lines[0].id, 3, 'ship-tenant-a');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headersB, 'return-tenant-b'),
            payload: returnPayload(orderA.orderNumber, fixtureA.merchantSku, 1, 'MRN-TENANT-B'),
        });
        expect(response.statusCode).toBe(404);
    });

    it('works with API key authentication', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-api-key', 2);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 2, 'ship-api-key');
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId,
            actorPermissions: ['roles.read'],
            membershipId: user.membershipId,
        });
        const apiKey = await app.apiKeys.useCases.createApiKey.execute({
            tenantId,
            actorId: user.userId,
            actorPermissions: permissions.permissions,
            name: 'Return integration key',
            scopes: ['returns.create'],
        });

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'return-api-key-req',
            },
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 1, 'MRN-API-KEY'),
        });
        expect(response.statusCode).toBe(201);
    });

    it('prevents concurrent returns from exceeding eligible shipped quantity', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-concurrent', 5);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 5, 'ship-concurrent');

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/returns',
                headers: returnHeaders(headers, 'return-concurrent-a'),
                payload: returnPayload(order.orderNumber, fixture.merchantSku, 3, 'MRN-CONCURRENT-A'),
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/returns',
                headers: returnHeaders(headers, 'return-concurrent-b'),
                payload: returnPayload(order.orderNumber, fixture.merchantSku, 3, 'MRN-CONCURRENT-B'),
            }),
        ]);

        const successCount = [responseA, responseB].filter((result) => result.statusCode === 201).length;
        expect(successCount).toBeLessThanOrEqual(1);

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        const totalRequested = returns.json().data.items.reduce(
            (sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
            0,
        );
        expect(totalRequested).toBeLessThanOrEqual(5);
    });

    it('reuses the same return for duplicate MerchantReturnNo with different idempotency keys', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-dup-replay', 4);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 4, 'ship-dup-replay');
        const merchantReturnNo = 'MRN-DUP-REPLAY-1';
        const payload = returnPayload(order.orderNumber, fixture.merchantSku, 2, merchantReturnNo);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-dup-replay-a'),
            payload,
        });
        expect(first.statusCode).toBe(201);

        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-dup-replay-b'),
            payload,
        });
        expect(second.statusCode).toBe(201);

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items).toHaveLength(1);
    });

    it('rejects duplicate MerchantReturnNo with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-dup-conflict', 4);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 4, 'ship-dup-conflict');
        const merchantReturnNo = 'MRN-DUP-CONFLICT-1';

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-dup-conflict-a'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 2, merchantReturnNo),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-dup-conflict-b'),
            payload: returnPayload(order.orderNumber, fixture.merchantSku, 3, merchantReturnNo),
        });
        expect(conflict.statusCode).toBe(409);
        expect(conflict.json().Success).toBe(false);

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items).toHaveLength(1);
        expect(returns.json().data.items[0].lines[0].quantity).toBe(2);
    });

    it('prevents concurrent duplicate MerchantReturnNo from creating two returns', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'return-dup-concurrent', 4);
        await shipOrderQuantity(server, headers, order.id, order.lines[0].id, 4, 'ship-dup-concurrent');
        const merchantReturnNo = 'MRN-DUP-CONCURRENT-1';
        const payload = returnPayload(order.orderNumber, fixture.merchantSku, 2, merchantReturnNo);

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/returns',
                headers: returnHeaders(headers, 'return-dup-concurrent-a'),
                payload,
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/returns',
                headers: returnHeaders(headers, 'return-dup-concurrent-b'),
                payload,
            }),
        ]);

        expect(responseA.statusCode).toBe(201);
        expect(responseB.statusCode).toBe(201);

        const returns = await server.inject({
            method: 'GET',
            url: `/api/v1/returns?orderId=${order.id}`,
            headers,
        });
        expect(returns.json().data.items).toHaveLength(1);
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
            url: '/api/v2/returns',
            headers: returnHeaders(headers, 'return-rate-limited'),
            payload: returnPayload('ORD-RATE-LIMIT', 'SKU-1', 1),
        });
        expect(response.statusCode).toBe(429);
    });
});
