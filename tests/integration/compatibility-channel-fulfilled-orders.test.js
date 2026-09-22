import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    seedCommerceFixture,
} from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const FULFILLED_URL = '/api/v2/orders/channel-fulfilled';

describe('POST /api/v2/orders/channel-fulfilled integration', () => {
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

    async function shipmentForOrder(tenantId, orderId) {
        return app.infra.database.execute(async (tx) => {
            const shipments = await app.shipments.listShipmentsForOrder(tx, tenantId, orderId);
            return shipments[0] ?? null;
        }, { tenantId });
    }

    it('returns 401 without credentials', async () => {
        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: { 'idempotency-key': 'channel-fulfilled-unauth' },
            payload: channelOrderPayload({ merchantSku: 'SKU-1' }, 'CH-UNAUTH-FUL'),
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ Success: false, StatusCode: 401 });
    });

    it('returns 403 without orders.ingest_channel_fulfilled permission', async () => {
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
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                authHeaders(viewer.accessToken),
                'channel-fulfilled-forbidden',
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, `CH-FORBIDDEN-FUL-${Date.now()}`),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('orders.ingest_channel_fulfilled');
    });

    it('returns 403 when only orders.ingest is granted', async () => {
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
            url: FULFILLED_URL,
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'channel-fulfilled-ingest-only',
            },
            payload: channelOrderPayload(fixture, `CH-INGEST-ONLY-${Date.now()}`),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().Message).toContain('orders.ingest_channel_fulfilled');
    });

    it('creates a SHIPPED channel-fulfilled order without inventory reservation', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const channelOrderNo = `CH-FUL-${Date.now()}`;

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                headers,
                'channel-fulfilled-happy-1',
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, channelOrderNo, 2),
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.Success).toBe(true);
        expect(body.StatusCode).toBe(201);
        expect(body.Content.Status).toBe('SHIPPED');
        expect(body.Content.ChannelOrderNo).toBe(channelOrderNo);

        const inventory = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory/${fixture.productId}?stockLocationId=${fixture.stockLocationId}`,
            headers,
        });
        expect(inventory.json().data.every((balance) => balance.reserved === 0)).toBe(true);

        const order = await app.orders.orderQueryService.findOrderByOrderNumber(
            tenantId,
            body.Content.MerchantOrderNo,
        );
        expect(order.status).toBe('SHIPPED');

        const shipment = await shipmentForOrder(tenantId, order.id);
        expect(shipment).not.toBeNull();
        expect(shipment.status).toBe('SHIPPED');
    });

    it('emits expected events exactly once', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const channelOrderNo = `CH-FUL-EVENTS-${Date.now()}`;

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                headers,
                'channel-fulfilled-events',
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, channelOrderNo),
        });
        expect(response.statusCode).toBe(201);

        const order = await app.orders.orderQueryService.findOrderByOrderNumber(
            tenantId,
            response.json().Content.MerchantOrderNo,
        );
        const shipment = await shipmentForOrder(tenantId, order.id);
        expect(shipment).not.toBeNull();

        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, order.id, 'order.created')).toBe(1);
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, order.id, 'order.confirmed')).toBe(1);
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, order.id, 'order.status_changed')).toBe(1);
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, shipment.id, 'shipment.created')).toBe(1);
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, shipment.id, 'shipment.shipped')).toBe(1);
        expect(await countOutboxEventsForOrder(app.infra.database, tenantId, shipment.id, 'shipment.status_changed')).toBe(1);
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
            ['orders.ingest_channel_fulfilled'],
        );

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: {
                ...apiKeyHeaders(apiKey.secret),
                'idempotency-key': 'channel-fulfilled-api-key',
            },
            payload: channelOrderPayload(fixture, `CH-FUL-API-${Date.now()}`),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().Content.Status).toBe('SHIPPED');
    });

    it('replays safely with the same Idempotency-Key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const payload = channelOrderPayload(fixture, `CH-FUL-IDEM-${Date.now()}`);
        const requestHeaders = channelOrderHeaders(
            headers,
            'channel-fulfilled-idem',
            channelContext.channelExternalReference,
        );

        const first = await server.inject({ method: 'POST', url: FULFILLED_URL, headers: requestHeaders, payload });
        const second = await server.inject({ method: 'POST', url: FULFILLED_URL, headers: requestHeaders, payload });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().Content.MerchantOrderNo).toBe(first.json().Content.MerchantOrderNo);
    });

    it('returns 409 for the same Idempotency-Key with a conflicting payload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const requestHeaders = channelOrderHeaders(
            headers,
            'channel-fulfilled-conflict',
            channelContext.channelExternalReference,
        );

        const first = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: requestHeaders,
            payload: channelOrderPayload(fixture, `CH-FUL-CONFLICT-A-${Date.now()}`),
        });
        expect(first.statusCode).toBe(201);

        const second = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: requestHeaders,
            payload: channelOrderPayload(fixture, `CH-FUL-CONFLICT-B-${Date.now()}`),
        });
        expect(second.statusCode).toBe(409);
    });

    it('deduplicates by tenant, channel, and external order reference', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const channelOrderNo = `CH-FUL-DEDUP-${Date.now()}`;
        const payload = channelOrderPayload(fixture, channelOrderNo);

        const first = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(headers, 'channel-fulfilled-dedup-1', channelContext.channelExternalReference),
            payload,
        });
        const second = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(headers, 'channel-fulfilled-dedup-2', channelContext.channelExternalReference),
            payload,
        });
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.json().Content.MerchantOrderNo).toBe(first.json().Content.MerchantOrderNo);
    });

    it('returns 409 when external reference matches an existing NEW channel order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const channelOrderNo = `CH-MIXED-${Date.now()}`;
        const payload = channelOrderPayload(fixture, channelOrderNo);

        const normal = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(headers, 'channel-order-before-fulfilled', channelContext.channelExternalReference),
            payload,
        });
        expect(normal.statusCode).toBe(201);
        expect(normal.json().Content.Status).toBe('NEW');

        const fulfilled = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(headers, 'channel-fulfilled-after-new', channelContext.channelExternalReference),
            payload,
        });
        expect(fulfilled.statusCode).toBe(409);
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
            'tenant-a-fulfilled-channel',
        );
        await configureChannelForIngest(
            server,
            headersB,
            fixtureB.channelId,
            fixtureB.stockLocationId,
            'tenant-b-fulfilled-channel',
        );

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                headersB,
                'channel-fulfilled-cross-tenant',
                channelA.channelExternalReference,
            ),
            payload: channelOrderPayload(fixtureB, `CH-FUL-CROSS-${Date.now()}`),
        });
        expect(response.statusCode).toBe(404);
    });

    it('returns 422 for invalid quantity greater than ordered quantity is not applicable on create', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                headers,
                'channel-fulfilled-invalid-qty',
                channelContext.channelExternalReference,
            ),
            payload: {
                ...channelOrderPayload(fixture, `CH-FUL-BAD-QTY-${Date.now()}`),
                Lines: [{
                    MerchantProductNo: fixture.merchantSku,
                    Quantity: 0,
                    UnitPriceInclVat: 25,
                }],
            },
        });
        expect(response.statusCode).toBe(400);
    });

    it('returns 404 for unknown SKU', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );

        const response = await server.inject({
            method: 'POST',
            url: FULFILLED_URL,
            headers: channelOrderHeaders(
                headers,
                'channel-fulfilled-unknown-sku',
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload({ merchantSku: 'UNKNOWN-SKU' }, `CH-FUL-UNK-${Date.now()}`),
        });
        expect(response.statusCode).toBe(404);
    });

    it('does not change Phase 7.2 POST /api/v2/orders behavior', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        const channelContext = await configureChannelForIngest(
            server,
            headers,
            fixture.channelId,
            fixture.stockLocationId,
        );
        const channelOrderNo = `CH-REGRESSION-${Date.now()}`;

        const response = await server.inject({
            method: 'POST',
            url: '/api/v2/orders',
            headers: channelOrderHeaders(
                headers,
                'channel-order-regression',
                channelContext.channelExternalReference,
            ),
            payload: channelOrderPayload(fixture, channelOrderNo, 3),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().Content.Status).toBe('NEW');

        const inventory = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory/${fixture.productId}?stockLocationId=${fixture.stockLocationId}`,
            headers,
        });
        expect(inventory.json().data.some((balance) => balance.reserved === 3)).toBe(true);
    });
});
