import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { MarketplaceOrderLifecycleOperation } from '../../src/modules/marketplace-order-ingestion/index.js';
import { MarketplaceOrderLifecycleUnsupportedError } from '../../src/modules/marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';
import { ShopifyGraphqlClient } from '../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-graphql-client.js';
import { PostgresMarketplaceConnectionRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { hashWebhookIngressToken } from '../../src/modules/marketplace-webhook-ingestion/application/webhook-ingress-token.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { configureChannelForIngest } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

function signShopifyWebhook(body, secret) {
    return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

async function getOrCreateShopifyMarketplaceId(server, headers) {
    const listRes = await server.inject({ method: 'GET', url: '/api/v1/marketplaces', headers });
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
    return createRes.json().data.id;
}

describe('Shopify order lifecycle integration', () => {
    let app;
    let server;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    it('executes outbound cancel via generic lifecycle command (mocked GraphQL)', async () => {
        const executeSpy = vi.spyOn(ShopifyGraphqlClient.prototype, 'execute').mockResolvedValue({
            orderCancel: { job: { id: 'gid://shopify/Job/1' }, orderCancelUserErrors: [], userErrors: [] },
        });
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const marketplaceId = await getOrCreateShopifyMarketplaceId(server, headers);
        const channelRes = await server.inject({
            method: 'POST',
            url: '/api/v1/channels',
            headers,
            payload: { marketplaceId, name: `Shopify LC ${Date.now()}` },
        });
        const channelId = channelRes.json().data.id;
        const locationRes = await server.inject({
            method: 'POST',
            url: '/api/v1/stock-locations',
            headers,
            payload: { name: 'WH' },
        });
        const stockLocationId = locationRes.json().data.id;
        await configureChannelForIngest(server, headers, channelId, stockLocationId);
        await server.inject({
            method: 'POST',
            url: `/api/v1/channels/${channelId}/marketplace-connection`,
            headers,
            payload: {
                credentials: {
                    accessToken: 'shpat_test',
                    shopDomain: 'example.myshopify.com',
                    webhookSecret: 'shpss_test',
                },
                configuration: { shopifyLocationId: '1' },
            },
        });
        const result = await app.executeOutboundMarketplaceOrderLifecycle.execute({
            tenantId,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: 'gid://shopify/Order/1001',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: `cancel-${Date.now()}`,
            payload: { restock: true },
        });
        expect(result.outcome).toBe('cancelled');
        executeSpy.mockRestore();
    });

    it('deduplicates identical Shopify webhook deliveries', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const marketplaceId = await getOrCreateShopifyMarketplaceId(server, headers);
        const channelRes = await server.inject({
            method: 'POST',
            url: '/api/v1/channels',
            headers,
            payload: { marketplaceId, name: `Shopify WH ${Date.now()}` },
        });
        const channelId = channelRes.json().data.id;
        const locationRes = await server.inject({
            method: 'POST',
            url: '/api/v1/stock-locations',
            headers,
            payload: { name: 'WH2' },
        });
        await configureChannelForIngest(server, headers, channelId, locationRes.json().data.id);
        const connectionRes = await server.inject({
            method: 'POST',
            url: `/api/v1/channels/${channelId}/marketplace-connection`,
            headers,
            payload: {
                credentials: {
                    accessToken: 'shpat_test',
                    shopDomain: 'example.myshopify.com',
                    webhookSecret: 'shpss_test',
                },
                configuration: { shopifyLocationId: '1' },
            },
        });
        expect([200, 201]).toContain(connectionRes.statusCode);
        const ingressToken = `ingress-${Date.now()}`;
        const connections = new PostgresMarketplaceConnectionRepository();
        await app.infra.database.execute(async (tx) => {
            const connection = await connections.findActiveByChannel(tx, tenantId, channelId);
            if (connection !== null) {
                await connections.updateWebhookIngressTokenHash(tx, tenantId, connection.id, hashWebhookIngressToken(ingressToken));
            }
        }, { tenantId });
        const body = JSON.stringify({
            admin_graphql_api_id: 'gid://shopify/Order/9001',
            id: 9001,
            name: '#9001',
            currency: 'USD',
            financial_status: 'paid',
            fulfillment_status: null,
            line_items: [{
                id: 1,
                admin_graphql_api_id: 'gid://shopify/LineItem/1',
                sku: 'SKU-MISSING',
                quantity: 1,
                price: '10.00',
            }],
        });
        const webhookHeaders = {
            'content-type': 'application/json',
            'x-shopify-topic': 'orders/create',
            'x-shopify-webhook-id': `wh-${Date.now()}`,
            'x-shopify-hmac-sha256': signShopifyWebhook(body, 'shpss_test'),
        };
        const url = `/api/v1/inbound/marketplace-webhooks/${ingressToken}`;
        const first = await server.inject({ method: 'POST', url, headers: webhookHeaders, payload: body });
        const second = await server.inject({ method: 'POST', url, headers: webhookHeaders, payload: body });
        expect(first.statusCode).toBe(second.statusCode);
        if (first.statusCode === 200) {
            expect(second.json().replayed).toBe(true);
        }
    });

    it('rejects Shopify webhooks with invalid HMAC', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const marketplaceId = await getOrCreateShopifyMarketplaceId(server, headers);
        const channelRes = await server.inject({
            method: 'POST',
            url: '/api/v1/channels',
            headers,
            payload: { marketplaceId, name: `Shopify HMAC ${Date.now()}` },
        });
        const channelId = channelRes.json().data.id;
        const locationRes = await server.inject({
            method: 'POST',
            url: '/api/v1/stock-locations',
            headers,
            payload: { name: 'WH3' },
        });
        await configureChannelForIngest(server, headers, channelId, locationRes.json().data.id);
        await server.inject({
            method: 'POST',
            url: `/api/v1/channels/${channelId}/marketplace-connection`,
            headers,
            payload: {
                credentials: {
                    accessToken: 'shpat_test',
                    shopDomain: 'example.myshopify.com',
                    webhookSecret: 'shpss_test',
                },
                configuration: { shopifyLocationId: '1' },
            },
        });
        const ingressToken = `ingress-hmac-${Date.now()}`;
        const connections = new PostgresMarketplaceConnectionRepository();
        await app.infra.database.execute(async (tx) => {
            const active = await connections.findActiveByChannel(tx, tenantId, channelId);
            if (active !== null) {
                await connections.updateWebhookIngressTokenHash(tx, tenantId, active.id, hashWebhookIngressToken(ingressToken));
            }
        }, { tenantId });
        const body = JSON.stringify({ id: 1, line_items: [] });
        const res = await server.inject({
            method: 'POST',
            url: `/api/v1/inbound/marketplace-webhooks/${ingressToken}`,
            headers: {
                'content-type': 'application/json',
                'x-shopify-topic': 'orders/create',
                'x-shopify-webhook-id': 'wh-hmac-bad',
                'x-shopify-hmac-sha256': 'not-valid-hmac',
            },
            payload: body,
        });
        expect(res.statusCode).toBe(401);
    });

    it('documents outbound return gap: Shopify supports returns but Nexora outbound adapter does not', async () => {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const marketplaceId = await getOrCreateShopifyMarketplaceId(server, headers);
        const channelRes = await server.inject({
            method: 'POST',
            url: '/api/v1/channels',
            headers,
            payload: { marketplaceId, name: `Shopify Return ${Date.now()}` },
        });
        const channelId = channelRes.json().data.id;
        await server.inject({
            method: 'POST',
            url: `/api/v1/channels/${channelId}/marketplace-connection`,
            headers,
            payload: {
                credentials: {
                    accessToken: 'shpat_test',
                    shopDomain: 'example.myshopify.com',
                    webhookSecret: 'shpss_test',
                },
                configuration: { shopifyLocationId: '1' },
            },
        });
        await expect(app.executeOutboundMarketplaceOrderLifecycle.execute({
            tenantId,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: 'gid://shopify/Order/1001',
            operation: MarketplaceOrderLifecycleOperation.RETURN_ORDER,
            idempotencyKey: `return-${Date.now()}`,
            payload: { lines: [{ externalLineItemId: 'gid://shopify/LineItem/1', quantity: 1 }] },
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('deduplicates repeated outbound cancel commands via idempotency', async () => {
        vi.spyOn(ShopifyGraphqlClient.prototype, 'execute').mockResolvedValue({
            orderCancel: { job: { id: 'gid://shopify/Job/2' }, orderCancelUserErrors: [], userErrors: [] },
        });
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const marketplaceId = await getOrCreateShopifyMarketplaceId(server, headers);
        const channelRes = await server.inject({
            method: 'POST',
            url: '/api/v1/channels',
            headers,
            payload: { marketplaceId, name: `Shopify IDEM ${Date.now()}` },
        });
        const channelId = channelRes.json().data.id;
        await server.inject({
            method: 'POST',
            url: `/api/v1/channels/${channelId}/marketplace-connection`,
            headers,
            payload: {
                credentials: {
                    accessToken: 'shpat_test',
                    shopDomain: 'example.myshopify.com',
                    webhookSecret: 'shpss_test',
                },
                configuration: { shopifyLocationId: '1' },
            },
        });
        const idempotencyKey = `cancel-idem-${Date.now()}`;
        const input = {
            tenantId,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: 'gid://shopify/Order/1002',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey,
            payload: { restock: true },
        };
        const first = await app.executeOutboundMarketplaceOrderLifecycle.execute(input);
        const second = await app.executeOutboundMarketplaceOrderLifecycle.execute(input);
        expect(first.outcome).toBe('cancelled');
        expect(second.outcome).toBe('cancelled');
        expect(ShopifyGraphqlClient.prototype.execute).toHaveBeenCalledTimes(1);
    });
});
