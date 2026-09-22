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
    channelOrderHeaders,
    channelOrderPayload,
    configureChannelForIngest,
    countOutboxEventsForOrder,
    createChannelScopedApiKey,
    createOrder,
    seedCommerceFixture,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('POST /api/v2/orders integration', () => {
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

    async function ownerPermissions(tenantId) {
        const roles = await app.authorization.useCases.listRoles.execute({
            tenantId,
            actorPermissions: ['tenant.admin', 'roles.read'],
        });
        const ownerRole = roles.find((role) => role.systemKey === 'owner');
        expect(ownerRole).toBeDefined();
        return ownerRole.permissionKeys;
    }

    it('returns 401 without credentials', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: { 'idempotency-key': 'channel-order-unauth' },
            payload: channelOrderPayload({ merchantSku: 'SKU-1' }, 'CH-UNAUTH'),
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 without orders.ingest permission', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const owner = await createAuthenticatedUser(app, tenantId, slug);
        const ownerHeaders = authHeaders(owner.accessToken);
        const fixture = await seedCommerceFixture(server, ownerHeaders);
        const channelContext = await configureChannelForIngest(
            server,
            ownerHeaders,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenantId, slug, 'viewer');

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(
                authHeaders(viewer.accessToken),
                'channel-order-forbidden',
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, 'CH-FORBIDDEN'),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('orders.ingest');
    });

    it('creates a NEW channel order with inventory reservation and order.created only', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const channelOrderNo = `CH-${Date.now()}`;

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-happy-1', channelContext.channelExternalReference),
            payload: channelOrderPayload(fixture, channelOrderNo, 2),
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.StatusCode).toBe(201);
        expect(body.Content.Status).toBe('NEW');
        expect(body.Content.ChannelOrderNo).toBe(channelOrderNo);
        expect(body.Content.MerchantOrderNo).toMatch(/^ORD-/);

        const inventory = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory/${fixture.productId}?stockLocationId=${fixture.stockLocationId}`,
            headers,
        });
        expect(inventory.json().data.some((balance) => balance.reserved === 2)).toBe(true);

        const orderId = (await app.orders.orderQueryService.findOrderByOrderNumber(
            tenantId,
            body.Content.MerchantOrderNo,
        )).id;
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, orderId, 'order.created')).toBe(1);
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, orderId, 'order.confirmed')).toBe(0);
    });

    it('works with a channel-scoped API key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const permissions = await ownerPermissions(tenantId);
        const apiKey = await createChannelScopedApiKey(
            app,
            tenantId,
            user.userId,
            permissions,
            fixture.channelId,
            ['orders.ingest'],
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'channel-order-api-key',
            },
            payload: channelOrderPayload(fixture, `CH-API-${Date.now()}`),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().Content.Status).toBe('NEW');
    });

    it('returns 422 when inventory is insufficient and rolls back order creation', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-no-stock', channelContext.channelExternalReference),
            payload: channelOrderPayload(fixture, `CH-NO-STOCK-${Date.now()}`, 500),
        });
        expect(response.statusCode).toBe(422);
        expect(response.json().Success).toBe(false);

        const inventory = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory/${fixture.productId}?stockLocationId=${fixture.stockLocationId}`,
            headers,
        });
        expect(inventory.json().data.every((balance) => balance.reserved === 0)).toBe(true);
    });

    it('replays safely with the same Idempotency-Key and does not create a duplicate order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const payload = channelOrderPayload(fixture, `CH-IDEM-${Date.now()}`);
        const requestHeaders = channelOrderHeaders(headers, 'channel-order-idem', channelContext.channelExternalReference);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: requestHeaders,
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: requestHeaders,
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().Content.MerchantOrderNo).toBe(first.json().Content.MerchantOrderNo);

        const listRes = await server.inject({
            method: 'GET',
            url: `/api/v2/orders?ChannelOrderNos=${encodeURIComponent(payload.ChannelOrderNo)}`,
            headers,
        });
        expect(listRes.json().TotalCount).toBe(1);
    });

    it('returns 409 for the same Idempotency-Key with a conflicting payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const requestHeaders = channelOrderHeaders(headers, 'channel-order-conflict', channelContext.channelExternalReference);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: requestHeaders,
            payload: channelOrderPayload(fixture, `CH-CONFLICT-A-${Date.now()}`),
        });
        expect(first.statusCode).toBe(201);

        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: requestHeaders,
            payload: channelOrderPayload(fixture, `CH-CONFLICT-B-${Date.now()}`),
        });
        expect(second.statusCode).toBe(409);
    });

    it('deduplicates by tenant, channel, and external order reference', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const channelOrderNo = `CH-DEDUP-${Date.now()}`;
        const payload = channelOrderPayload(fixture, channelOrderNo);

        const first = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-dedup-1', channelContext.channelExternalReference),
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-dedup-2', channelContext.channelExternalReference),
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().Content.MerchantOrderNo).toBe(first.json().Content.MerchantOrderNo);
    });

    it('rejects channel references from another tenant', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const headersA = authHeaders(userA.accessToken);
        const headersB = authHeaders(userB.accessToken);
        const fixtureA = await seedCommerceFixture(server, headersA);
        const fixtureB = await seedCommerceFixture(server, headersB);
        const channelA = await configureChannelForIngest(
            server,
            headersA,
            fixtureA.channelId,
            fixtureA.stockLocationId,
            'tenant-a-channel',
        );
        await configureChannelForIngest(
            server,
            headersB,
            fixtureB.channelId,
            fixtureB.stockLocationId,
            'tenant-b-channel',
        );

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headersB, 'channel-order-cross-tenant', channelA.channelExternalReference),
            payload: channelOrderPayload(fixtureB, `CH-CROSS-${Date.now()}`),
        });
        expect(response.statusCode).toBe(404);
    });

    it('returns 422 when channel stock location is not configured', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await server.inject({
            method: 'PATCH',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
            payload: { externalReference: 'channel-no-stock-location' },
        });

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-no-location', 'channel-no-stock-location'),
            payload: channelOrderPayload(fixture, `CH-NO-LOC-${Date.now()}`),
        });
        expect(response.statusCode).toBe(422);
    });

    it('does not change native POST /api/v1/orders behavior', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const order = await createOrder(server, headers, fixture, `native-${Date.now()}`);
        expect(order.status).toBe('CONFIRMED');
    });

    it('does not change existing GET /api/v2/orders and GET /api/v2/orders/new behavior', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const channelOrderNo = `CH-LIST-${Date.now()}`;

        await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-list', channelContext.channelExternalReference),
            payload: channelOrderPayload(fixture, channelOrderNo),
        });

        const listRes = await server.inject({
            method: 'GET',
            url: `/api/v2/orders?ChannelOrderNos=${encodeURIComponent(channelOrderNo)}`,
            headers,
        });
        expect(listRes.statusCode).toBe(200);
        expect(listRes.json().Content[0].ChannelOrderNo).toBe(channelOrderNo);

        const newRes = await server.inject({
            method: 'GET',
            url: '/api/v2/orders/new',
            headers,
        });
        expect(newRes.statusCode).toBe(200);
        expect(newRes.json().Content.some((entry) => entry.ChannelOrderNo === channelOrderNo)).toBe(true);
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
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-rate-limited', 'missing-channel'),
            payload: channelOrderPayload({ merchantSku: 'SKU-RATE' }, 'CH-RATE-LIMIT'),
        });
        expect(response.statusCode).toBe(429);
    });
});
