import { describe, expect, it, vi } from 'vitest';
import { MarketplaceCatalogAdapterPermanentError } from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import { NormalizedMarketplaceOrderStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { mapShopifyOrderToNormalized } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/map-shopify-order-to-normalized.js';
import { mapShopifyOrderStatus } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-order-status.js';
import { ShopifyOrderAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-order-adapter.js';
import { ShopifyGraphqlClient } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-graphql-client.js';
import { MarketplaceHttpClient } from '../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import { MarketplaceValidationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { buildShopifyGraphqlOrder } from './shopify-order-fixtures.js';

const STOCK_LOCATION_ID = '00000000-0000-4000-8000-000000000010';

const runtime = {
    marketplaceKey: 'shopify',
    connectionRequired: true,
    credentials: { shopDomain: 'example.myshopify.com', accessToken: 'shpat_test' },
    configuration: {},
};

function money(amount, currencyCode = 'USD') {
    return { shopMoney: { amount: String(amount), currencyCode } };
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('mapShopifyOrderStatus', () => {
    it('maps paid unfulfilled orders to confirmed', () => {
        expect(mapShopifyOrderStatus({
            cancelledAt: null,
            displayFinancialStatus: 'PAID',
            displayFulfillmentStatus: 'UNFULFILLED',
        })).toBe(NormalizedMarketplaceOrderStatus.CONFIRMED);
    });

    it('maps cancelled orders to cancelled', () => {
        expect(mapShopifyOrderStatus({
            cancelledAt: '2024-01-01T00:00:00Z',
            displayFinancialStatus: 'PAID',
            displayFulfillmentStatus: 'FULFILLED',
        })).toBe(NormalizedMarketplaceOrderStatus.CANCELLED);
    });

    it('rejects refunded financial status', () => {
        expect(() => mapShopifyOrderStatus({
            cancelledAt: null,
            displayFinancialStatus: 'REFUNDED',
            displayFulfillmentStatus: 'UNFULFILLED',
        })).toThrow(MarketplaceValidationError);
    });
});

describe('mapShopifyOrderToNormalized', () => {
    it('maps order id, name, money, customer, and addresses', () => {
        const normalized = mapShopifyOrderToNormalized(buildShopifyGraphqlOrder(), {
            marketplaceKey: 'shopify',
            stockLocationId: STOCK_LOCATION_ID,
        });
        expect(normalized.externalOrderId).toBe('gid://shopify/Order/1001');
        expect(normalized.externalOrderNumber).toBe('#1001');
        expect(normalized.marketplaceKey).toBe('shopify');
        expect(normalized.status).toBe(NormalizedMarketplaceOrderStatus.CONFIRMED);
        expect(normalized.currency).toBe('USD');
        expect(normalized.subtotalMinor).toBe(2000);
        expect(normalized.totalMinor).toBe(2700);
        expect(normalized.customer?.firstName).toBe('Ada');
        expect(normalized.customer?.shippingAddress?.city).toBe('Boston');
        expect(normalized.customer?.billingAddress?.line2).toBe('Suite 1');
    });

    it('maps multiple line items with SKU', () => {
        const normalized = mapShopifyOrderToNormalized(buildShopifyGraphqlOrder({
            lineItems: {
                edges: [
                    { node: { id: 'gid://shopify/LineItem/1', sku: 'A', quantity: 1, variant: null, originalUnitPriceSet: money(5) } },
                    { node: { id: 'gid://shopify/LineItem/2', sku: 'B', quantity: 3, variant: null, originalUnitPriceSet: money(2) } },
                ],
            },
        }), { marketplaceKey: 'shopify', stockLocationId: STOCK_LOCATION_ID });
        expect(normalized.lines).toHaveLength(2);
        expect(normalized.lines[0].merchantSku).toBe('A');
        expect(normalized.lines[1].quantity).toBe(3);
    });

    it('maps variant id when SKU is missing', () => {
        const normalized = mapShopifyOrderToNormalized(buildShopifyGraphqlOrder({
            lineItems: {
                edges: [{
                    node: {
                        id: 'gid://shopify/LineItem/9',
                        sku: null,
                        quantity: 1,
                        variant: { id: 'gid://shopify/ProductVariant/88', sku: null },
                        originalUnitPriceSet: money(1),
                    },
                }],
            },
        }), { marketplaceKey: 'shopify', stockLocationId: STOCK_LOCATION_ID });
        expect(normalized.lines[0].marketplaceExternalEntity?.externalEntityId).toBe('gid://shopify/ProductVariant/88');
    });

    it('throws when line has no SKU or variant', () => {
        expect(() => mapShopifyOrderToNormalized(buildShopifyGraphqlOrder({
            lineItems: {
                edges: [{ node: { id: 'x', sku: null, quantity: 1, variant: null, originalUnitPriceSet: money(1) } }],
            },
        }), { marketplaceKey: 'shopify', stockLocationId: STOCK_LOCATION_ID })).toThrow(MarketplaceValidationError);
    });

    it('throws on malformed order payload', () => {
        expect(() => mapShopifyOrderToNormalized(null, {
            marketplaceKey: 'shopify',
            stockLocationId: STOCK_LOCATION_ID,
        })).toThrow(MarketplaceValidationError);
    });
});

describe('ShopifyOrderAdapter', () => {
    it('fetchOrder loads order by GID', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            data: { order: buildShopifyGraphqlOrder() },
        }));
        const adapter = new ShopifyOrderAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const order = await adapter.fetchOrder(runtime, {
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
            stockLocationId: STOCK_LOCATION_ID,
            correlationId: null,
        });
        expect(order.externalOrderId).toContain('gid://shopify/Order/');
        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.variables.id).toBe('gid://shopify/Order/1001');
    });

    it('fetchOrder maps missing order to permanent adapter error', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ data: { order: null } }));
        const adapter = new ShopifyOrderAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await expect(adapter.fetchOrder(runtime, {
            tenantId: '1',
            channelId: '2',
            marketplaceKey: 'shopify',
            externalOrderId: '999',
            stockLocationId: STOCK_LOCATION_ID,
            correlationId: null,
        })).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('listOrders returns first page', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            data: {
                orders: {
                    edges: [{ node: buildShopifyGraphqlOrder({ id: 'gid://shopify/Order/2001', name: '#2001' }) }],
                    pageInfo: { hasNextPage: false, endCursor: 'cursor1' },
                },
            },
        }));
        const adapter = new ShopifyOrderAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const page = await adapter.listOrders(runtime, {
            tenantId: '1',
            channelId: '2',
            marketplaceKey: 'shopify',
            stockLocationId: STOCK_LOCATION_ID,
            correlationId: null,
        }, { first: 10 });
        expect(page.orders).toHaveLength(1);
        expect(page.hasNextPage).toBe(false);
        expect(page.endCursor).toBe('cursor1');
    });

    it('listOrders continues with cursor', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                data: {
                    orders: {
                        edges: [{ node: buildShopifyGraphqlOrder({ id: 'gid://shopify/Order/1' }) }],
                        pageInfo: { hasNextPage: true, endCursor: 'cur-a' },
                    },
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: {
                    orders: {
                        edges: [],
                        pageInfo: { hasNextPage: false, endCursor: null },
                    },
                },
            }));
        const adapter = new ShopifyOrderAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const first = await adapter.listOrders(runtime, {
            tenantId: '1',
            channelId: '2',
            marketplaceKey: 'shopify',
            stockLocationId: STOCK_LOCATION_ID,
            correlationId: null,
        }, { first: 1 });
        expect(first.hasNextPage).toBe(true);
        const second = await adapter.listOrders(runtime, {
            tenantId: '1',
            channelId: '2',
            marketplaceKey: 'shopify',
            stockLocationId: STOCK_LOCATION_ID,
            correlationId: null,
        }, { first: 1, after: 'cur-a' });
        expect(second.orders).toHaveLength(0);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
        expect(secondBody.variables.after).toBe('cur-a');
    });

    it('propagates provider error between pages as adapter error', async () => {
        const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
        const adapter = new ShopifyOrderAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await expect(adapter.listOrders(runtime, {
            tenantId: '1',
            channelId: '2',
            marketplaceKey: 'shopify',
            stockLocationId: STOCK_LOCATION_ID,
            correlationId: null,
        }, { first: 5 })).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });
});
