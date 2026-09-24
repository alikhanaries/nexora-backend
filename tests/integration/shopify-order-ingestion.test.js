import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AesSecretEncryptor } from '../../src/infrastructure/auth/aes-secret-encryptor.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { MarketplaceAdapterRuntimeFactory } from '../../src/modules/marketplaces/application/marketplace-adapter-runtime-factory.js';
import { PostgresMarketplaceConnectionRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { DefaultMarketplaceEntityMappingLookup } from '../../src/modules/marketplaces/public/index.js';
import { PostgresMarketplaceEntityMappingRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-entity-mapping-repository.js';
import { PostgresMarketplaceRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-repository.js';
import { registerMarketplaceOrderAdapters } from '../../src/modules/marketplaces/infrastructure/adapters/register-marketplace-order-adapters.js';
import { ShopifyOrderAdapter } from '../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-order-adapter.js';
import { ShopifyGraphqlClient } from '../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-graphql-client.js';
import { MarketplaceHttpClient } from '../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import { createMarketplaceOrderIngestionModule } from '../../src/modules/marketplace-order-ingestion/index.js';
import { MarketplaceOrderIngestionPermanentError } from '../../src/modules/marketplace-order-ingestion/public/marketplace-order-ingestion-errors.js';
import { DefaultProductQueryService } from '../../src/modules/products/public/index.js';
import { PostgresProductRepository } from '../../src/modules/products/infrastructure/postgres-product-repository.js';
import { buildShopifyGraphqlOrder } from '../unit/marketplaces/shopify-order-fixtures.js';
import { mapShopifyOrderToNormalized } from '../../src/modules/marketplaces/infrastructure/adapters/shopify/map-shopify-order-to-normalized.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { configureChannelForIngest } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

async function getOrCreateShopifyMarketplaceId(server, headers) {
    const listRes = await server.inject({ method: 'GET', url: '/api/v1/marketplaces', headers });
    expect(listRes.statusCode).toBe(200);
    const existing = listRes.json().data.find((m) => m.key === 'shopify');
    if (existing !== undefined) {
        return existing.id;
    }
    const createRes = await server.inject({
        method: 'POST',
        url: '/api/v1/marketplaces',
        headers,
        payload: { key: 'shopify', name: 'Shopify' },
    });
    expect([201, 409]).toContain(createRes.statusCode);
    if (createRes.statusCode === 201) {
        return createRes.json().data.id;
    }
    const again = await server.inject({ method: 'GET', url: '/api/v1/marketplaces', headers });
    return again.json().data.find((m) => m.key === 'shopify').id;
}

async function seedShopifyOrderFixture(server, headers) {
    const marketplaceId = await getOrCreateShopifyMarketplaceId(server, headers);
    const channelRes = await server.inject({
        method: 'POST',
        url: '/api/v1/channels',
        headers,
        payload: { marketplaceId, name: `Shopify Channel ${Date.now()}` },
    });
    expect(channelRes.statusCode).toBe(201);
    const channelId = channelRes.json().data.id;
    const merchantSku = `SHOP-SKU-${Date.now()}`;
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
        payload: { name: 'Shopify WH' },
    });
    expect(locationRes.statusCode).toBe(201);
    const stockLocationId = locationRes.json().data.id;
    await configureChannelForIngest(server, headers, channelId, stockLocationId);
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
    await server.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/marketplace-connection`,
        headers,
        payload: {
            credentials: { accessToken: 'shpat_test', shopDomain: 'example.myshopify.com' },
            configuration: { shopifyLocationId: '1' },
        },
    });
    return { channelId, stockLocationId, merchantSku, productId };
}

describe('Shopify marketplace order ingestion integration', () => {
    let app;
    let server;
    let ingestionModule;
    let config;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        config = infra.config;
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
        const secretEncryptor = new AesSecretEncryptor(config.auth.mfaEncryptionKey);
        const marketplaceAdapterRuntimeFactory = new MarketplaceAdapterRuntimeFactory({
            connections: new PostgresMarketplaceConnectionRepository(),
            secretEncryptor,
            queryable: infra.database,
            shopifyAdminApiVersion: config.marketplace.shopifyAdminApiVersion,
        });
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
            marketplaceAdapterRuntimeFactory,
            registerMarketplaceOrderAdapters: (registry) => registerMarketplaceOrderAdapters(registry),
        });
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('ingests normalized Shopify-mapped order by SKU', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedShopifyOrderFixture(server, headers);
        const shopifyOrder = buildShopifyGraphqlOrder({
            lineItems: {
                edges: [{
                    node: {
                        id: 'gid://shopify/LineItem/1',
                        sku: fixture.merchantSku,
                        quantity: 1,
                        variant: null,
                        originalUnitPriceSet: { shopMoney: { amount: '10', currencyCode: 'USD' } },
                    },
                }],
            },
        });
        const normalized = mapShopifyOrderToNormalized(shopifyOrder, {
            marketplaceKey: 'shopify',
            stockLocationId: fixture.stockLocationId,
        });
        const result = await ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: normalized,
        });
        expect(result.outcome).toBe('created');
        expect(result.order.externalOrderReference).toBe('gid://shopify/Order/1001');
    });

    it('fetchOrder via adapter creates one Nexora order and deduplicates', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedShopifyOrderFixture(server, headers);
        const externalGid = `gid://shopify/Order/${Date.now()}`;
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            data: {
                order: buildShopifyGraphqlOrder({
                    id: externalGid,
                    lineItems: {
                        edges: [{
                            node: {
                                id: 'gid://shopify/LineItem/1',
                                sku: fixture.merchantSku,
                                quantity: 1,
                                variant: null,
                                originalUnitPriceSet: { shopMoney: { amount: '10', currencyCode: 'USD' } },
                            },
                        }],
                    },
                }),
            },
        }), { status: 200 }));
        const marketplaceRepository = new PostgresMarketplaceRepository();
        const marketplaceLookup = {
            findById: async (marketplaceId) => {
                const m = await marketplaceRepository.findById(app.infra.database, marketplaceId);
                return m === null ? null : { id: m.id, key: m.key, status: m.status };
            },
        };
        const productQueryService = new DefaultProductQueryService({
            queryable: app.infra.database,
            products: new PostgresProductRepository(),
        });
        const adapterModule = createMarketplaceOrderIngestionModule({
            database: app.infra.database,
            channelQueryService: app.channels.channelQueryService,
            marketplaceLookup,
            createChannelOrder: app.orders.createChannelOrder,
            marketplaceEntityMappingLookup: new DefaultMarketplaceEntityMappingLookup({
                mappings: new PostgresMarketplaceEntityMappingRepository(),
                queryable: app.infra.database,
            }),
            productQueryService,
            metrics: app.infra.metrics,
            marketplaceAdapterRuntimeFactory: new MarketplaceAdapterRuntimeFactory({
                connections: new PostgresMarketplaceConnectionRepository(),
                secretEncryptor: new AesSecretEncryptor(config.auth.mfaEncryptionKey),
                queryable: app.infra.database,
            }),
            registerMarketplaceOrderAdapters: (registry) => {
                registry.register(new ShopifyOrderAdapter({
                    graphql: new ShopifyGraphqlClient({
                        http: new MarketplaceHttpClient({ fetchImpl }),
                    }),
                }));
            },
        });
        const first = await adapterModule.ingestNormalizedMarketplaceOrder.execute({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'shopify',
            externalOrderId: externalGid,
        });
        const second = await adapterModule.ingestNormalizedMarketplaceOrder.execute({
            tenantId,
            channelId: fixture.channelId,
            marketplaceKey: 'shopify',
            externalOrderId: externalGid,
        });
        expect(first.outcome).toBe('created');
        expect(second.outcome).toBe('duplicate');
        expect(second.order.id).toBe(first.order.id);
    });

    it('does not persist order when line SKU cannot be resolved', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedShopifyOrderFixture(server, headers);
        const normalized = mapShopifyOrderToNormalized(buildShopifyGraphqlOrder({
            id: `gid://shopify/Order/missing-${Date.now()}`,
            lineItems: {
                edges: [{
                    node: {
                        id: 'gid://shopify/LineItem/1',
                        sku: 'UNKNOWN-SKU-999',
                        quantity: 1,
                        variant: null,
                        originalUnitPriceSet: { shopMoney: { amount: '10', currencyCode: 'USD' } },
                    },
                }],
            },
        }), { marketplaceKey: 'shopify', stockLocationId: fixture.stockLocationId });
        await expect(ingestionModule.ingestionService.ingest({
            tenantId,
            channelId: fixture.channelId,
            order: normalized,
        })).rejects.toBeInstanceOf(MarketplaceOrderIngestionPermanentError);
        const listRes = await server.inject({
            method: 'GET',
            url: '/api/v1/orders',
            headers,
        });
        const orders = listRes.json().data.items ?? listRes.json().data;
        const match = Array.isArray(orders)
            ? orders.find((o) => o.externalOrderReference === normalized.externalOrderId)
            : undefined;
        expect(match).toBeUndefined();
    });
});
