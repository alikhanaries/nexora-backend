import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createMarketplaceOrderIngestionModule } from '../../src/modules/marketplace-order-ingestion/index.js';
import { MarketplaceOrderLifecycleOperation } from '../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';
import { NormalizedMarketplaceOrderStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { NamshiOrderAdapter } from '../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-order-adapter.js';
import { DefaultMarketplaceEntityMappingLookup } from '../../src/modules/marketplaces/public/index.js';
import { PostgresMarketplaceEntityMappingRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-entity-mapping-repository.js';
import { PostgresMarketplaceRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { PostgresOrderRepository } from '../../src/modules/orders/infrastructure/postgres-order-repository.js';
import { DefaultProductQueryService } from '../../src/modules/products/public/index.js';
import { PostgresProductRepository } from '../../src/modules/products/infrastructure/postgres-product-repository.js';
import { buildNamshiFbpiGetOrderResponse, buildNamshiFbpiOrderSyncWebhook } from '../unit/marketplaces/namshi-fbpi-fixtures.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function seedNamshiChannel(server, headers) {
    const listRes = await server.inject({ method: 'GET', url: '/api/v1/marketplaces', headers });
    let marketplace = listRes.json().data.find((m) => m.key === 'namshi');
    if (marketplace === undefined) {
        const createMp = await server.inject({
            method: 'POST',
            url: '/api/v1/marketplaces',
            headers,
            payload: { key: 'namshi', name: 'Namshi' },
        });
        expect([201, 409]).toContain(createMp.statusCode);
        marketplace = (await server.inject({ method: 'GET', url: '/api/v1/marketplaces', headers }))
            .json().data.find((m) => m.key === 'namshi');
    }
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId: marketplace.id, name: `Namshi Channel ${Date.now()}` },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const merchantSku = `NAMSHI-SKU-${Date.now()}`;
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
        payload: { name: 'Namshi WH' },
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
            referenceId: `rcpt-namshi-${Date.now()}`,
        },
    });
    await server.inject({
        method: 'POST',
        url: '/api/v1/prices',
        headers,
        payload: { productId, channelId, currency: 'USD', amountMinor: 1500 },
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
    return { channelId, stockLocationId, merchantSku };
}

describe('Namshi order lifecycle integration', () => {
    let app;
    let server;
    let module;
    let getFbpiOrder;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        getFbpiOrder = vi.fn(async () => ({ json: buildNamshiFbpiGetOrderResponse() }));
        const marketplaceRepository = new PostgresMarketplaceRepository();
        const marketplaceLookup = {
            findById: async (marketplaceId) => {
                const m = await marketplaceRepository.findById(infra.database, marketplaceId);
                return m === null ? null : { id: m.id, key: m.key, status: m.status };
            },
        };
        const productQueryService = new DefaultProductQueryService({
            database: infra.database,
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
            marketplaceAdapterRuntimeFactory: {
                createForSync: async () => ({
                    marketplaceKey: 'namshi',
                    credentials: {},
                    configuration: { countryCode: 'ae', warehouseCode: 'WH-TEST' },
                }),
            },
            registerMarketplaceOrderAdapters: (registry) => {
                registry.register(new NamshiOrderAdapter({
                    api: { getFbpiOrder },
                }));
            },
        });
    });

    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('createApplication wires lifecycle webhook processing for all marketplaces', () => {
        expect(app.marketplaceOrderIngestion.processMarketplaceLifecyclePayload).toBeDefined();
        expect(app.marketplaceOrderIngestion.orderAdapterRegistry.resolve('namshi')).toBeInstanceOf(NamshiOrderAdapter);
    });

    it('applies FBPI webhook lifecycle payload through ProcessMarketplaceLifecyclePayload', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedNamshiChannel(server, headers);
        const externalOrderId = 'NFBO123456789';
        const ingest = await module.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: {
                externalOrderId,
                marketplaceKey: 'namshi',
                status: NormalizedMarketplaceOrderStatus.PENDING,
                currency: 'USD',
                lines: [{ quantity: 1, stockLocationId: fixture.stockLocationId, merchantSku: fixture.merchantSku }],
            },
        });
        expect(ingest.outcome).toBe('created');
        const processor = module.processMarketplaceLifecyclePayload;
        expect(processor).toBeDefined();
        const first = await processor.execute({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'namshi',
            payload: {
                source: 'fbpi_order_sync',
                event: buildNamshiFbpiOrderSyncWebhook(),
            },
        });
        expect(first.outcome).toBe('applied');
        expect(getFbpiOrder).toHaveBeenCalled();
        const order = await app.orders.orderQueryService.findOrderById(tenantId, ingest.order.id);
        expect(order.status).toBe('CONFIRMED');
        const duplicate = await processor.execute({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'namshi',
            payload: {
                source: 'fbpi_order_sync',
                event: buildNamshiFbpiOrderSyncWebhook(),
            },
        });
        expect(duplicate.outcome).toBe('duplicate');
    });

    it('applies partial cancellation lifecycle from FBPI order items', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedNamshiChannel(server, headers);
        const externalOrderId = 'NFBO-PARTIAL-CANCEL';
        const ingest = await module.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: {
                externalOrderId,
                marketplaceKey: 'namshi',
                status: NormalizedMarketplaceOrderStatus.PENDING,
                currency: 'USD',
                lines: [
                    { quantity: 1, stockLocationId: fixture.stockLocationId, merchantSku: fixture.merchantSku },
                    { quantity: 1, stockLocationId: fixture.stockLocationId, merchantSku: fixture.merchantSku },
                ],
            },
        });
        expect(ingest.outcome).toBe('created');
        await app.orders.useCases.confirmOrder.execute({
            tenantId,
            actorId: 'test',
            actorKind: 'api-key',
            actorPermissions: ['orders.update'],
            orderId: ingest.order.id,
        });
        getFbpiOrder.mockResolvedValueOnce({
            json: buildNamshiFbpiGetOrderResponse({
                fbpi_order_nr: externalOrderId,
                items: [
                    {
                        mp_item_nr: `${externalOrderId}-1`,
                        partner_sku: fixture.merchantSku,
                        mp_status: 'MP_ITEM_STATUS_CONFIRMED',
                        integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
                    },
                    {
                        mp_item_nr: `${externalOrderId}-2`,
                        partner_sku: fixture.merchantSku,
                        mp_status: 'MP_ITEM_STATUS_CANCELLED',
                        integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
                    },
                ],
            }),
        });
        const result = await module.processMarketplaceLifecyclePayload.execute({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'namshi',
            payload: {
                source: 'fbpi_order_sync',
                event: buildNamshiFbpiOrderSyncWebhook({
                    payload: { order_nr: externalOrderId },
                    metadata: {
                        message_id: 'msg-partial-cancel',
                        published_at: '2026-04-09T09:00:00Z',
                    },
                }),
            },
        });
        expect(result.outcome).toBe('applied');
    });

    it('does not apply Namshi lifecycle command to another tenant order', async () => {
        const tenantA = await createTestTenant(server);
        const tenantB = await createTestTenant(server);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const fixtureA = await seedNamshiChannel(server, authHeaders(userA.accessToken));
        await seedNamshiChannel(server, authHeaders(userB.accessToken));
        const externalOrderId = 'NFBO-TENANT-A';
        await module.ingestionService.ingest({
            tenantId: tenantA.tenantId,
            channelId: fixtureA.channelId,
            order: {
                externalOrderId,
                marketplaceKey: 'namshi',
                status: NormalizedMarketplaceOrderStatus.PENDING,
                currency: 'USD',
                lines: [{
                    quantity: 1,
                    stockLocationId: fixtureA.stockLocationId,
                    merchantSku: fixtureA.merchantSku,
                }],
            },
        });
        getFbpiOrder.mockResolvedValueOnce({ json: buildNamshiFbpiGetOrderResponse({ fbpi_order_nr: externalOrderId }) });
        await expect(module.lifecycleService.apply({
            tenantId: tenantB.tenantId,
            channelId: fixtureA.channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey: 'namshi',
                externalOrderId,
                externalEventId: `evt-tenant-b-${Date.now()}`,
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        })).rejects.toThrow();
    });
});
