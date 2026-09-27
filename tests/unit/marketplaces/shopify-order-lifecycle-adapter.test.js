import { describe, expect, it, vi } from 'vitest';
import { ShopifyOrderLifecycleAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-order-lifecycle-adapter.js';
import { MarketplaceCatalogAdapterPermanentError } from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

const runtime = {
    marketplaceKey: 'shopify',
    credentials: { shopDomain: 'example.myshopify.com', accessToken: 'shpat_test' },
    configuration: {},
    connectionRequired: true,
};

const context = {
    tenantId: '22222222-2222-4222-8222-222222222222',
    channelId: '33333333-3333-4333-8333-333333333333',
    marketplaceKey: 'shopify',
    externalOrderId: 'gid://shopify/Order/1001',
    correlationId: null,
};

describe('ShopifyOrderLifecycleAdapter', () => {
    it('cancels order via orderCancel mutation', async () => {
        const graphql = {
            execute: vi.fn(async () => ({
                orderCancel: { job: { id: 'gid://shopify/Job/1', done: false }, orderCancelUserErrors: [], userErrors: [] },
            })),
        };
        const adapter = new ShopifyOrderLifecycleAdapter({ graphql });
        const result = await adapter.cancelOrder(runtime, context, { restock: true });
        expect(result.outcome).toBe('cancelled');
        expect(graphql.execute).toHaveBeenCalledWith(
            runtime,
            expect.stringContaining('orderCancel'),
            expect.objectContaining({ orderId: context.externalOrderId }),
        );
    });

    it('maps Shopify userErrors to permanent adapter errors', async () => {
        const graphql = {
            execute: vi.fn(async () => ({
                refundCreate: { userErrors: [{ message: 'Refund not allowed' }] },
            })),
        };
        const adapter = new ShopifyOrderLifecycleAdapter({ graphql });
        await expect(adapter.refundOrder(runtime, context, {})).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('creates fulfillment from fulfillment orders', async () => {
        const graphql = {
            execute: vi.fn()
                .mockResolvedValueOnce({
                    order: {
                        fulfillmentOrders: {
                            edges: [{
                                node: {
                                    id: 'gid://shopify/FulfillmentOrder/1',
                                    lineItems: {
                                        edges: [{
                                            node: {
                                                id: 'gid://shopify/FulfillmentOrderLineItem/1',
                                                remainingQuantity: 2,
                                                lineItem: { id: 'gid://shopify/LineItem/1' },
                                            },
                                        }],
                                    },
                                },
                            }],
                        },
                    },
                })
                .mockResolvedValueOnce({
                    fulfillmentCreate: {
                        fulfillment: { id: 'gid://shopify/Fulfillment/9', status: 'SUCCESS' },
                        userErrors: [],
                    },
                }),
        };
        const adapter = new ShopifyOrderLifecycleAdapter({ graphql });
        const result = await adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'gid://shopify/LineItem/1', quantity: 1 }],
            trackingNumber: '1Z999',
        });
        expect(result.outcome).toBe('fulfilled');
        expect(graphql.execute).toHaveBeenCalledTimes(2);
    });

    it('reports unsupported returns capability', () => {
        const adapter = new ShopifyOrderLifecycleAdapter({ graphql: { execute: vi.fn() } });
        expect(adapter.getLifecycleCapabilities().supportsOutboundReturns).toBe(false);
    });

    it('throws validation error when fulfillment orders are missing', async () => {
        const graphql = { execute: vi.fn(async () => ({ order: { fulfillmentOrders: { edges: [] } } })) };
        const adapter = new ShopifyOrderLifecycleAdapter({ graphql });
        await expect(adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'gid://shopify/LineItem/1', quantity: 1 }],
        })).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });
});
