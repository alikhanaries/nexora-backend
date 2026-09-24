import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { DefaultMarketplaceEntityMappingLookup } from '../../src/modules/marketplaces/public/index.js';
import { PostgresMarketplaceEntityMappingRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-entity-mapping-repository.js';
import { PostgresMarketplaceRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { PostgresProductRepository } from '../../src/modules/products/infrastructure/postgres-product-repository.js';
import { DefaultProductQueryService } from '../../src/modules/products/public/index.js';
import { createMarketplaceOrderIngestionModule } from '../../src/modules/marketplace-order-ingestion/index.js';
import { NormalizedMarketplaceOrderStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { MarketplaceOrderIngestionPermanentError } from '../../src/modules/marketplace-order-ingestion/public/marketplace-order-ingestion-errors.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function seedMarketplaceOrderFixture(server, headers) {
    const marketplaceKey = `mp_ingest_${Date.now()}`;
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: marketplaceKey, name: 'Ingest Test MP' },
    });
    expect(marketplaceRes.statusCode).toBe(201);
    const marketplaceId = marketplaceRes.json().data.id;
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId, name: 'Ingest Channel' },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const merchantSku = `ING-${Date.now()}`;
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
        payload: { name: 'Ingest WH' },
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
            quantity: 50,
            referenceType: 'TEST',
            referenceId: `rcpt-${Date.now()}`,
        },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/prices',
        headers,
        payload: { productId, channelId, currency: 'USD', amountMinor: 2500 },
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
    return { marketplaceKey, channelId, stockLocationId, merchantSku, offerId, productId };
}

function buildNormalizedOrder(fixture, externalOrderId) {
    return {
        externalOrderId,
        marketplaceKey: fixture.marketplaceKey,
        status: NormalizedMarketplaceOrderStatus.PENDING,
        currency: 'USD',
        lines: [{
            quantity: 1,
            stockLocationId: fixture.stockLocationId,
            merchantSku: fixture.merchantSku,
        }],
    };
}

describe('marketplace order ingestion integration', () => {
    /** @type {Awaited<ReturnType<typeof createApplication>>} */
    let app;
    /** @type {import('fastify').FastifyInstance} */
    let server;
    /** @type {ReturnType<typeof createMarketplaceOrderIngestionModule>} */
    let ingestionModule;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        const marketplaceRepository = new PostgresMarketplaceRepository();
        const marketplaceLookup = {
            findById: async (marketplaceId) => {
                const m = await marketplaceRepository.findById(infra.database, marketplaceId);
                return m === null ? null : { id: m.id, key: m.key, status: m.status };
            },
        };
        const productQueryService = new DefaultProductQueryService({
            queryable: infra.database,
            products: new PostgresProductRepository(),
        });
        ingestionModule = createMarketplaceOrderIngestionModule({
            database: infra.database,
            channelQueryService: app.channels.channelQueryService,
            marketplaceLookup,
            createChannelOrder: app.orders.createChannelOrder,
            marketplaceEntityMappingLookup: new DefaultMarketplaceEntityMappingLookup({
                mappings: new PostgresMarketplaceEntityMappingRepository(),
                queryable: infra.database,
            }),
            productQueryService,
            metrics: infra.metrics,
        });
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates one Nexora order on first ingest', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedMarketplaceOrderFixture(server, headers);
        const externalOrderId = `ext-${Date.now()}`;
        const result = await ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: buildNormalizedOrder(fixture, externalOrderId),
        });
        expect(result.outcome).toBe('created');
        expect(result.order.externalOrderReference).toBe(externalOrderId);
        expect(result.order.status).toBe('NEW');
    });

    it('returns duplicate on second ingest with same external order id', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedMarketplaceOrderFixture(server, headers);
        const externalOrderId = `dup-${Date.now()}`;
        const order = buildNormalizedOrder(fixture, externalOrderId);
        const first = await ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order,
        });
        const second = await ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order,
        });
        expect(first.outcome).toBe('created');
        expect(second.outcome).toBe('duplicate');
        expect(second.order.id).toBe(first.order.id);
    });

    it('allows same external order id on different channels', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixtureA = await seedMarketplaceOrderFixture(server, headers);
        const fixtureB = await seedMarketplaceOrderFixture(server, headers);
        const externalOrderId = `shared-ext-${Date.now()}`;
        const resultA = await ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixtureA.channelId,
            order: buildNormalizedOrder(fixtureA, externalOrderId),
        });
        const resultB = await ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixtureB.channelId,
            order: buildNormalizedOrder(fixtureB, externalOrderId),
        });
        expect(resultA.order.id).not.toBe(resultB.order.id);
    });

    it('rejects marketplaceKey mismatch (tenant channel isolation)', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedMarketplaceOrderFixture(server, headers);
        await expect(ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: {
                ...buildNormalizedOrder(fixture, `bad-${Date.now()}`),
                marketplaceKey: 'wrong_marketplace_key',
            },
        })).rejects.toBeInstanceOf(MarketplaceOrderIngestionPermanentError);
    });

    it('handles concurrent duplicate ingest', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedMarketplaceOrderFixture(server, headers);
        const externalOrderId = `conc-${Date.now()}`;
        const order = buildNormalizedOrder(fixture, externalOrderId);
        const results = await Promise.all([
            ingestionModule.ingestionService.ingest({ tenantId, channelId: fixture.channelId, order }),
            ingestionModule.ingestionService.ingest({ tenantId, channelId: fixture.channelId, order }),
        ]);
        const orderIds = new Set(results.map((r) => r.order.id));
        expect(orderIds.size).toBe(1);
        expect(results.filter((r) => r.outcome === 'created').length).toBe(1);
        expect(results.filter((r) => r.outcome === 'duplicate').length).toBe(1);
    });

    it('handles five concurrent deliveries of the same marketplace order', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedMarketplaceOrderFixture(server, headers);
        const externalOrderId = `conc5-${Date.now()}`;
        const order = buildNormalizedOrder(fixture, externalOrderId);
        const results = await Promise.all(Array.from({ length: 5 }, () => ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order,
        })));
        const orderIds = new Set(results.map((r) => r.order.id));
        expect(orderIds.size).toBe(1);
        expect(results.filter((r) => r.outcome === 'created').length).toBe(1);
        expect(results.filter((r) => r.outcome === 'duplicate').length).toBe(4);
    });
});
