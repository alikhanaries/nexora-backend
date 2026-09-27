import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createMarketplaceOrderIngestionModule } from '../../src/modules/marketplace-order-ingestion/index.js';
import { MarketplaceOrderLifecycleOperation } from '../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';
import { NormalizedMarketplaceOrderStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { MarketplaceOrderLifecycleUnsupportedError } from '../../src/modules/marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';
import { DefaultMarketplaceEntityMappingLookup } from '../../src/modules/marketplaces/public/index.js';
import { PostgresMarketplaceEntityMappingRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-entity-mapping-repository.js';
import { PostgresMarketplaceRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { PostgresOrderRepository } from '../../src/modules/orders/infrastructure/postgres-order-repository.js';
import { DefaultProductQueryService } from '../../src/modules/products/public/index.js';
import { PostgresProductRepository } from '../../src/modules/products/infrastructure/postgres-product-repository.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const LIFECYCLE_MARKETPLACE_KEY = 'mp_lifecycle_integration';

async function seedLifecycleFixture(server, headers) {
    const marketplaceRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: LIFECYCLE_MARKETPLACE_KEY, name: 'Lifecycle Test MP' },
    });
    expect([201, 409]).toContain(marketplaceRes.statusCode);
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId: (await server.inject({ method: 'GET', url: '/api/v1/marketplaces', headers })).json().data.find((m) => m.key === LIFECYCLE_MARKETPLACE_KEY).id, name: `Lifecycle Channel ${Date.now()}` },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const merchantSku = `LIFE-SKU-${Date.now()}`;
    const productRes = await server.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers,
        payload: { merchantSku, productType: 'STANDARD' },
    });
    const productId = productRes.json().data.id;
    const locationRes = await server.inject({
        method: 'POST',
        url: '/api/v1/stock-locations',
        headers,
        payload: { name: 'Lifecycle WH' },
    });
    const stockLocationId = locationRes.json().data.id;
    await server.inject({
        method: 'POST',
        url: '/api/v1/inventory/receipts',
        headers,
        payload: {
            stockLocationId,
            productId,
            quantity: 10,
            referenceType: 'TEST',
            referenceId: `rcpt-${Date.now()}`,
        },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/prices',
        headers,
        payload: { productId, channelId, currency: 'USD', amountMinor: 1200 },
    });
    const offerRes = await server.inject({
        method: 'POST',
        url: '/api/v1/offers',
        headers,
        payload: { productId, channelId },
    });
    const offerId = offerRes.json().data.id;
    await server.inject({
        method: 'POST',
        url: `/api/v1/offers/${offerId}/activate`,
        headers,
        payload: { requirePricing: true },
    });
    return { channelId, stockLocationId, merchantSku, marketplaceKey: LIFECYCLE_MARKETPLACE_KEY };
}

describe('marketplace order lifecycle integration', () => {
    let app;
    let server;
    let module;

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
        module = createMarketplaceOrderIngestionModule({
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
            orders: new PostgresOrderRepository(),
            confirmOrder: app.orders.useCases.confirmOrder,
            cancellationCommandService: app.cancellations.cancellationCommandService,
            idempotency: infra.idempotency,
            registerMarketplaceOrderAdapters: (registry) => {
                registry.register({
                    marketplaceKey: LIFECYCLE_MARKETPLACE_KEY,
                    getOrderLifecycleCapabilities: () => ({
                        supportsOrderUpdate: false,
                        supportsOrderCancel: true,
                        supportsOrderReturn: false,
                        supportsOrderRefund: false,
                        supportsOrderFulfill: false,
                        supportsShipmentUpdate: false,
                        supportsOrderStatusSync: true,
                    }),
                });
            },
        });
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('confirms ingested order via status_sync lifecycle command', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedLifecycleFixture(server, headers);
        const externalOrderId = `life-${Date.now()}`;
        const ingest = await module.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: {
                externalOrderId,
                marketplaceKey: fixture.marketplaceKey,
                status: NormalizedMarketplaceOrderStatus.PENDING,
                currency: 'USD',
                lines: [{ quantity: 1, stockLocationId: fixture.stockLocationId, merchantSku: fixture.merchantSku }],
            },
        });
        expect(ingest.outcome).toBe('created');
        const first = await module.lifecycleService.apply({
            tenantId,
            channelId: fixture.channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey: fixture.marketplaceKey,
                externalOrderId,
                externalEventId: `evt-confirm-${Date.now()}`,
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        });
        expect(first.outcome).toBe('applied');
        const order = await app.orders.orderQueryService.findOrderById(tenantId, ingest.order.id);
        expect(order.status).toBe('CONFIRMED');
        const duplicate = await module.lifecycleService.apply({
            tenantId,
            channelId: fixture.channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey: fixture.marketplaceKey,
                externalOrderId,
                externalEventId: `evt-confirm-${Date.now()}`,
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        });
        expect(duplicate.outcome).toBe('duplicate');
    });

    it('rejects lifecycle when marketplace adapter lacks capability', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedLifecycleFixture(server, headers);
        await expect(module.lifecycleService.apply({
            tenantId,
            channelId: fixture.channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.REFUND_ORDER,
                marketplaceKey: fixture.marketplaceKey,
                externalOrderId: 'missing',
                externalEventId: 'evt-refund',
            },
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });
});
