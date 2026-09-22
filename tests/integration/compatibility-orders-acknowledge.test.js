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
    ExternalIdMappingResourceType,
} from '../../src/modules/external-id-mapping/public/index.js';
import {
    acknowledgeHeaders,
    acknowledgePayload,
    createOrder,
    findCompatExternalId,
    seedCommerceFixture,
    setOrderToNew,
    snapshotAcknowledgeSideEffects,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('POST /api/v2/orders/acknowledge integration', () => {
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
            url: '/api/v2/orders/acknowledge',
            headers: { 'idempotency-key': 'ack-unauth' },
            payload: acknowledgePayload('ORD-MISSING', 1),
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 without orders.update permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const admin = await createAuthenticatedUser(app, tenantId, slug);
        const adminHeaders = authHeaders(admin.accessToken);
        const fixture = await seedCommerceFixture(server, adminHeaders);
        const order = await createOrder(server, adminHeaders, fixture, 'ack-forbidden-order');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const user = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'fulfillment_operator');
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(authHeaders(user.accessToken), 'ack-forbidden'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('orders.update');
    });

    it('acknowledges a NEW order and transitions to CONFIRMED', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-new-1');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'ack-happy-1'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            Success: true,
            StatusCode: 201,
            Message: null,
        });

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.status).toBe('CONFIRMED');

        const sideEffects = await snapshotAcknowledgeSideEffects(app.infra.database, tenantId, order.id);
        expect(sideEffects.statusChanged).toBe(1);
        expect(sideEffects.confirmed).toBe(2);
        expect(sideEffects.auditStatusChanged).toBe(1);
    });

    it('is idempotent for an already CONFIRMED order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-confirmed-1');
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const baseline = await snapshotAcknowledgeSideEffects(app.infra.database, tenantId, order.id);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'ack-idem-confirmed-1'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(first.statusCode).toBe(201);

        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'ack-idem-confirmed-2'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(second.statusCode).toBe(201);

        const after = await snapshotAcknowledgeSideEffects(app.infra.database, tenantId, order.id);
        expect(after).toEqual(baseline);
    });

    it('handles concurrent acknowledgement with distinct idempotency keys safely', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-concurrent');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );

        const baseline = await snapshotAcknowledgeSideEffects(app.infra.database, tenantId, order.id);
        const payload = acknowledgePayload(order.orderNumber, orderExternalId);

        const [responseA, responseB] = await Promise.all([
            server.inject({
                method: 'POST',
                url: '/api/v2/orders/acknowledge',
                headers: acknowledgeHeaders(headers, 'ack-concurrent-a'),
                payload,
            }),
            server.inject({
                method: 'POST',
                url: '/api/v2/orders/acknowledge',
                headers: acknowledgeHeaders(headers, 'ack-concurrent-b'),
                payload,
            }),
        ]);

        expect(responseA.statusCode).toBe(201);
        expect(responseB.statusCode).toBe(201);
        expect(responseA.json()).toEqual({ Success: true, StatusCode: 201, Message: null });
        expect(responseB.json()).toEqual({ Success: true, StatusCode: 201, Message: null });

        const getRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders/${order.id}`,
            headers,
        });
        expect(getRes.json().data.status).toBe('CONFIRMED');

        const after = await snapshotAcknowledgeSideEffects(app.infra.database, tenantId, order.id);
        expect(after.statusChanged).toBe(baseline.statusChanged + 1);
        expect(after.confirmed).toBe(baseline.confirmed + 1);
        expect(after.auditStatusChanged).toBe(baseline.auditStatusChanged + 1);
    });

    it('replays identical idempotent requests', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-idem-replay');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const idempotencyKey = 'ack-replay-key';
        const payload = acknowledgePayload(order.orderNumber, orderExternalId);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, idempotencyKey),
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, idempotencyKey),
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json()).toEqual(first.json());
    });

    it('rejects the same idempotency key with a different payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const orderA = await createOrder(server, headers, fixture, 'ack-conflict-a');
        const orderB = await createOrder(server, headers, fixture, 'ack-conflict-b');
        await setOrderToNew(app.infra.database, tenantId, orderA.id);
        await setOrderToNew(app.infra.database, tenantId, orderB.id);
        const orderExternalIdA = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderA.id,
        );
        const orderExternalIdB = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            orderB.id,
        );
        const idempotencyKey = 'ack-conflict-key';

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, idempotencyKey),
            payload: acknowledgePayload(orderA.orderNumber, orderExternalIdA),
        });
        expect(first.statusCode).toBe(201);

        const conflict = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, idempotencyKey),
            payload: acknowledgePayload(orderB.orderNumber, orderExternalIdB),
        });
        expect(conflict.statusCode).toBe(409);
    });

    it('returns 404 for unknown merchant order number', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'ack-not-found'),
            payload: acknowledgePayload('DOES-NOT-EXIST', 999999),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().Success).toBe(false);
        expect(response.json().Message).not.toMatch(/postgres|sql/i);
    });

    it('isolates tenants', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const orderA = await createOrder(server, headersA, fixtureA, 'ack-tenant-a');
        await setOrderToNew(app.infra.database, tenantA.tenantId, orderA.id);

        const crossTenant = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headersB, 'ack-cross-tenant'),
            payload: acknowledgePayload(orderA.orderNumber, 1),
        });
        expect(crossTenant.statusCode).toBe(404);
    });

    it('works with API key authentication', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-api-key');
        await setOrderToNew(app.infra.database, tenantId, order.id);
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        const permissions = await app.authorization.useCases.getEffectivePermissions.execute({
            tenantId,
            actorPermissions: ['roles.read'],
            membershipId: user.membershipId,
        });
        const apiKey = await app.apiKeys.useCases.createApiKey.execute({
            tenantId,
            actorId: user.userId,
            actorPermissions: permissions.permissions,
            name: 'Ack integration key',
            scopes: ['orders.update'],
        });

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'ack-api-key-req',
            },
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(response.statusCode).toBe(201);
    });

    it('returns 422 for invalid order state', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, 'ack-shipped');
        const orderExternalId = await findCompatExternalId(
            app,
            tenantId,
            ExternalIdMappingResourceType.ORDER,
            order.id,
        );
        await app.infra.database.query(
            `UPDATE orders SET status = 'SHIPPED', shipped_at = now() WHERE tenant_id = $1 AND id = $2`,
            [tenantId, order.id],
            { operation: 'test.set_shipped' },
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'ack-invalid-state'),
            payload: acknowledgePayload(order.orderNumber, orderExternalId),
        });
        expect(response.statusCode).toBe(422);
        expect(response.json().Success).toBe(false);
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
            url: '/api/v2/orders/acknowledge',
            headers: acknowledgeHeaders(headers, 'ack-rate-limited'),
            payload: acknowledgePayload('ORD-RATE-LIMIT', 1),
        });
        expect(response.statusCode).toBe(429);
    });
});
