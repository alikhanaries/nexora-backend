import { describe, expect, it, vi } from 'vitest';
import { NormalizedMarketplaceOrderStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';
import { FetchAndIngestMarketplaceOrders } from '../../../src/modules/marketplace-order-ingestion/application/fetch-and-ingest-marketplace-orders.js';
import { MarketplaceOrderAdapterRegistry } from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-adapter-registry.js';

const STOCK_LOCATION_ID = '00000000-0000-4000-8000-000000000020';
const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const CHANNEL_ID = '00000000-0000-4000-8000-000000000002';

function buildOrder(externalOrderId, status = NormalizedMarketplaceOrderStatus.PENDING) {
    return {
        externalOrderId,
        marketplaceKey: 'shopify',
        status,
        currency: 'USD',
        lines: [{
            quantity: 1,
            stockLocationId: STOCK_LOCATION_ID,
            merchantSku: 'SKU-1',
        }],
    };
}

describe('FetchAndIngestMarketplaceOrders', () => {
    it('skips non-ingestible statuses during poll', async () => {
        const listOrders = vi.fn(async () => ({
            orders: [
                buildOrder('gid://shopify/Order/cancelled', NormalizedMarketplaceOrderStatus.CANCELLED),
                buildOrder('gid://shopify/Order/pending', NormalizedMarketplaceOrderStatus.PENDING),
            ],
            hasNextPage: false,
            endCursor: null,
        }));
        const ingest = vi.fn(async ({ normalizedOrder }) => ({
            outcome: 'created',
            order: { id: `ord-${normalizedOrder.externalOrderId}` },
        }));
        const registry = new MarketplaceOrderAdapterRegistry();
        registry.register({
            marketplaceKey: 'shopify',
            getOrderCapabilities: () => ({
                supportsOrdersInbound: true,
                supportsOrderWebhookIngestion: false,
                supportsOrderPolling: true,
            }),
            listOrders,
        });
        const useCase = new FetchAndIngestMarketplaceOrders({
            ingestNormalizedMarketplaceOrder: { execute: ingest },
            orderAdapterRegistry: registry,
            channelQueryService: {
                getChannelById: async () => ({
                    tenantId: TENANT_ID,
                    id: CHANNEL_ID,
                    defaultStockLocationId: STOCK_LOCATION_ID,
                }),
            },
            marketplaceAdapterRuntimeFactory: {
                createForSync: async () => ({}),
            },
            database: { execute: async (fn) => fn({}) },
        });
        const result = await useCase.execute({
            tenantId: TENANT_ID,
            channelId: CHANNEL_ID,
            marketplaceKey: 'shopify',
        });
        expect(result.skippedNonIngestible).toBe(1);
        expect(ingest).toHaveBeenCalledTimes(1);
    });

    it('respects maxPages bound', async () => {
        const listOrders = vi.fn()
            .mockResolvedValueOnce({
                orders: [buildOrder('gid://shopify/Order/1')],
                hasNextPage: true,
                endCursor: 'c1',
            })
            .mockResolvedValueOnce({
                orders: [buildOrder('gid://shopify/Order/2')],
                hasNextPage: false,
                endCursor: null,
            });
        const registry = new MarketplaceOrderAdapterRegistry();
        registry.register({
            marketplaceKey: 'shopify',
            getOrderCapabilities: () => ({
                supportsOrdersInbound: true,
                supportsOrderWebhookIngestion: false,
                supportsOrderPolling: true,
            }),
            listOrders,
        });
        const useCase = new FetchAndIngestMarketplaceOrders({
            ingestNormalizedMarketplaceOrder: {
                execute: async () => ({ outcome: 'created', order: { id: 'x' } }),
            },
            orderAdapterRegistry: registry,
            channelQueryService: {
                getChannelById: async () => ({
                    tenantId: TENANT_ID,
                    defaultStockLocationId: STOCK_LOCATION_ID,
                }),
            },
            marketplaceAdapterRuntimeFactory: { createForSync: async () => ({}) },
            database: { execute: async (fn) => fn({}) },
        });
        const result = await useCase.execute({
            tenantId: TENANT_ID,
            channelId: CHANNEL_ID,
            marketplaceKey: 'shopify',
            maxPages: 1,
        });
        expect(result.pagesFetched).toBe(1);
        expect(result.hasNextPage).toBe(true);
        expect(listOrders).toHaveBeenCalledTimes(1);
    });
});
