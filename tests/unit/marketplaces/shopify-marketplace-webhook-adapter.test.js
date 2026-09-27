import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ShopifyMarketplaceWebhookAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-marketplace-webhook-adapter.js';
import { MarketplaceWebhookAuthenticationError, MarketplaceWebhookUnsupportedError, } from '../../../src/modules/marketplace-webhook-ingestion/public/marketplace-webhook-errors.js';
import { buildShopifyGraphqlOrder } from './shopify-order-fixtures.js';

const connection = {
    tenantId: '22222222-2222-4222-8222-222222222222',
    channelId: '33333333-3333-4333-8333-333333333333',
    marketplaceKey: 'shopify',
    connectionId: '11111111-1111-4111-8111-111111111111',
};

function sign(body, secret) {
    return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

function buildRestOrderPayload() {
    const graphql = buildShopifyGraphqlOrder();
    return {
        admin_graphql_api_id: graphql.id,
        id: 1001,
        name: graphql.name,
        currency: 'USD',
        financial_status: 'paid',
        fulfillment_status: null,
        line_items: [{
            id: 1,
            admin_graphql_api_id: 'gid://shopify/LineItem/1',
            sku: 'WIDGET-1',
            quantity: 2,
            price: '10.00',
            variant_id: 55,
        }],
    };
}

describe('ShopifyMarketplaceWebhookAdapter', () => {
    const runtime = {
        marketplaceKey: 'shopify',
        credentials: { webhookSecret: 'shpss_test', shopDomain: 'example.myshopify.com', accessToken: 'token' },
        configuration: {},
        connectionRequired: true,
    };

    function buildAdapter(overrides = {}) {
        return new ShopifyMarketplaceWebhookAdapter({
            marketplaceAdapterRuntimeFactory: {
                createForSync: vi.fn(async () => runtime),
            },
            channelQueryService: {
                getChannelById: vi.fn(async () => ({
                    tenantId: connection.tenantId,
                    id: connection.channelId,
                    defaultStockLocationId: '44444444-4444-4444-8444-444444444444',
                })),
            },
            database: {
                execute: vi.fn(async (work) => work({})),
            },
            shopifyOrderAdapter: {
                fetchOrder: vi.fn(),
            },
            ...overrides,
        });
    }

    it('authenticates valid Shopify webhook HMAC', async () => {
        const adapter = buildAdapter();
        const rawBody = JSON.stringify(buildRestOrderPayload());
        await expect(adapter.authenticateWebhookRequest({
            headers: { 'x-shopify-hmac-sha256': sign(rawBody, 'shpss_test') },
            rawBody,
            connection,
        })).resolves.toBeUndefined();
    });

    it('rejects invalid Shopify webhook HMAC', async () => {
        const adapter = buildAdapter();
        const rawBody = JSON.stringify(buildRestOrderPayload());
        await expect(adapter.authenticateWebhookRequest({
            headers: { 'x-shopify-hmac-sha256': 'bad-signature' },
            rawBody,
            connection,
        })).rejects.toBeInstanceOf(MarketplaceWebhookAuthenticationError);
    });

    it('normalizes orders/create webhook to generic order.create event', async () => {
        const adapter = buildAdapter();
        const rawBody = JSON.stringify(buildRestOrderPayload());
        const event = await adapter.normalizeWebhookEvent({
            headers: {
                'x-shopify-topic': 'orders/create',
                'x-shopify-webhook-id': 'wh_1',
                'x-shopify-hmac-sha256': sign(rawBody, 'shpss_test'),
            },
            rawBody,
            connection,
        });
        expect(event.eventKind).toBe('order.create');
        expect(event.deduplicationKey).toBe('shopify:webhook:wh_1');
        expect(event.resource.order.externalOrderId).toContain('gid://shopify/Order/');
    });

    it('rejects unsupported Shopify webhook topics', async () => {
        const adapter = buildAdapter();
        const rawBody = JSON.stringify({ id: 1 });
        await expect(adapter.normalizeWebhookEvent({
            headers: {
                'x-shopify-topic': 'products/update',
                'x-shopify-webhook-id': 'wh_2',
            },
            rawBody,
            connection,
        })).rejects.toBeInstanceOf(MarketplaceWebhookUnsupportedError);
    });
});
