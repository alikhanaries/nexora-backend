import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { BusinessRuleError } from '../../src/shared/errors/index.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { countOutboxEventsForOrder } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function seedCommerceFixture(server, headers, options = {}) {
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: `mp_${Date.now()}`, name: 'Channel Ingest Marketplace' },
    });
    expect(marketplaceRes.statusCode).toBe(201);
    const marketplaceId = marketplaceRes.json().data.id;
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: {
            marketplaceId,
            name: 'Channel Ingest Channel',
            ...(options.channelExternalReference === undefined
                ? {}
                : { externalReference: options.channelExternalReference }),
        },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const merchantSku = options.merchantSku ?? `SKU-${Date.now()}`;
    const productRes = await server.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers,
        payload: { merchantSku, productType: 'STANDARD' },
    });
    expect(productRes.statusCode).toBe(201);
    const productId = productRes.json().data.id;
    const locationRes = await server.inject({
        method: 'POST',
        url: '/api/v1/stock-locations',
        headers,
        payload: { name: 'Channel Ingest Warehouse' },
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
            quantity: options.stockQuantity ?? 20,
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
            amountMinor: 1800,
        },
    });
    const offerRes = await server.inject({
        method: 'POST',
        url: '/api/v1/offers',
        headers,
        payload: {
            productId,
            channelId,
            ...(options.offerExternalReference === undefined
                ? {}
                : { externalReference: options.offerExternalReference }),
        },
    });
    expect(offerRes.statusCode).toBe(201);
    const offerId = offerRes.json().data.id;
    await server.inject({
        method: 'POST',
        url: `/api/v1/offers/${offerId}/activate`,
        headers,
        payload: { requirePricing: true },
    });
    return {
        channelId,
        productId,
        stockLocationId,
        merchantSku,
        offerId,
    };
}

describe('phase 7.1 channel order ingestion integration', () => {
    let app;
    let server;
    let infra;

    beforeAll(async () => {
        infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
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

    it('creates a NEW channel order with inventory reservation and order.created only', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { channelId, stockLocationId, merchantSku } = await seedCommerceFixture(server, headers);
        const permissions = await ownerPermissions(tenantId);
        const externalOrderReference = `CH-ORDER-${Date.now()}`;

        const result = await app.orders.orderCommandService.createChannelOrder({
            tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: permissions,
            channelId,
            externalOrderReference,
            currency: 'USD',
            lines: [{
                stockLocationId,
                quantity: 3,
                merchantSku,
            }],
            customer: {
                firstName: 'Grace',
                lastName: 'Hopper',
                email: 'grace@example.com',
            },
        });

        expect(result.order.status).toBe('NEW');
        expect(result.order.confirmedAt).toBeNull();
        expect(result.order.externalOrderReference).toBe(externalOrderReference);
        expect(result.order.lines).toHaveLength(1);
        expect(result.order.customer.firstName).toBe('Grace');

        const createdCount = await countOutboxEventsForOrder(infra.database, tenantId, result.order.id, 'order.created');
        const confirmedCount = await countOutboxEventsForOrder(infra.database, tenantId, result.order.id, 'order.confirmed');
        expect(createdCount).toBe(1);
        expect(confirmedCount).toBe(0);

        const availabilityRes = await server.inject({
            method: 'GET',
            url: `/api/v1/inventory/${result.order.lines[0].productId}`,
            headers,
        });
        expect(availabilityRes.statusCode).toBe(200);
        const balances = availabilityRes.json().data;
        expect(balances.some((balance) => balance.reserved === 3 && balance.available === 17)).toBe(true);
    });

    it('deduplicates channel orders by tenant, channel, and external reference', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { channelId, stockLocationId, merchantSku } = await seedCommerceFixture(server, headers);
        const permissions = await ownerPermissions(tenantId);
        const externalOrderReference = `CH-DEDUP-${Date.now()}`;
        const command = {
            tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: permissions,
            channelId,
            externalOrderReference,
            currency: 'USD',
            lines: [{
                stockLocationId,
                quantity: 2,
                merchantSku,
            }],
        };

        const first = await app.orders.orderCommandService.createChannelOrder(command);
        const second = await app.orders.orderCommandService.createChannelOrder(command);

        expect(first.order.id).toBe(second.order.id);
        expect(await countOutboxEventsForOrder(infra.database, tenantId, first.order.id, 'order.created')).toBe(1);
    });

    it('replays channel order creation with the same idempotency key', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { channelId, stockLocationId, merchantSku } = await seedCommerceFixture(server, headers);
        const permissions = await ownerPermissions(tenantId);
        const command = {
            tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: permissions,
            channelId,
            externalOrderReference: `CH-IDEM-${Date.now()}`,
            currency: 'USD',
            lines: [{
                stockLocationId,
                quantity: 1,
                merchantSku,
            }],
            idempotencyKey: `channel-order-${Date.now()}`,
            principalFingerprint: user.userId,
            requestFingerprint: JSON.stringify({ channelId, merchantSku, quantity: 1 }),
        };

        const first = await app.orders.orderCommandService.createChannelOrder(command);
        const second = await app.orders.orderCommandService.createChannelOrder(command);

        expect(first.order.id).toBe(second.order.id);
    });

    it('rolls back when inventory is insufficient', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const { channelId, stockLocationId, merchantSku } = await seedCommerceFixture(server, headers, {
            stockQuantity: 1,
        });
        const permissions = await ownerPermissions(tenantId);
        const externalOrderReference = `CH-FAIL-${Date.now()}`;

        await expect(app.orders.orderCommandService.createChannelOrder({
            tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: permissions,
            channelId,
            externalOrderReference,
            currency: 'USD',
            lines: [{
                stockLocationId,
                quantity: 5,
                merchantSku,
            }],
        })).rejects.toBeInstanceOf(BusinessRuleError);

        const listRes = await server.inject({
            method: 'GET',
            url: `/api/v1/orders?externalOrderReference=${encodeURIComponent(externalOrderReference)}`,
            headers,
        });
        expect(listRes.statusCode).toBe(200);
        expect(listRes.json().data.items).toHaveLength(0);
    });

    it('resolves channel lines by offer external reference when merchant SKU is absent', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const channelProductNo = `CH-PROD-${Date.now()}`;
        const { channelId, stockLocationId, productId } = await seedCommerceFixture(server, headers, {
            offerExternalReference: channelProductNo,
        });
        const permissions = await ownerPermissions(tenantId);

        const result = await app.orders.orderCommandService.createChannelOrder({
            tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: permissions,
            channelId,
            externalOrderReference: `CH-OFFER-${Date.now()}`,
            currency: 'USD',
            lines: [{
                stockLocationId,
                quantity: 1,
                channelProductNo,
            }],
        });

        expect(result.order.status).toBe('NEW');
        expect(result.order.lines[0].productId).toBe(productId);
    });

    it('resolves channels by external reference through the public query port', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const channelExternalReference = `CH-REF-${Date.now()}`;
        const { channelId } = await seedCommerceFixture(server, headers, {
            channelExternalReference,
        });

        const channel = await app.channels.channelQueryService.getChannelByExternalReference(
            tenantId,
            channelExternalReference,
        );

        expect(channel.id).toBe(channelId);
    });
});
