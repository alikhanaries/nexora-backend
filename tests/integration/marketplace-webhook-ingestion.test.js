import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { PostgresMarketplaceConnectionRepository } from '../../src/modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { generateWebhookIngressToken, hashWebhookIngressToken } from '../../src/modules/marketplace-webhook-ingestion/application/webhook-ingress-token.js';
import {
    buildTestWebhookPayload,
    createTestMarketplaceWebhookAdapter,
    signTestWebhookBody,
} from '../helpers/test-marketplace-webhook-adapter.js';
import { authHeaders, createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { configureChannelForIngest, seedCommerceFixture } from './compatibility-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

describe('marketplace webhook ingestion integration', () => {
    let app;
    let server;
    let database;

    beforeAll(async () => {
        const infra = await getTestInfrastructure();
        database = infra.database;
        app = await createApplication(infra);
        server = app.httpServer;
        await server.ready();
    });

    afterAll(async () => {
        await server?.close();
        await closeTestInfrastructure();
    });

    async function seedWebhookFixture() {
        const { tenantId, slug } = await createTestTenant(server);
        const user = await createAuthenticatedUser(app, tenantId, slug);
        const headers = authHeaders(user.accessToken);
        const fixture = await seedCommerceFixture(server, headers);
        await configureChannelForIngest(server, headers, fixture.channelId, fixture.stockLocationId);
        const channelRes = await server.inject({
            method: 'GET',
            url: `/api/v1/channels/${fixture.channelId}`,
            headers,
        });
        const marketplaceId = channelRes.json().data.marketplaceId;
        const marketplaceRes = await server.inject({
            method: 'GET',
            url: `/api/v1/marketplaces/${marketplaceId}`,
            headers,
        });
        const marketplaceKey = marketplaceRes.json().data.key;
        const connectionRes = await server.inject({
            method: 'POST',
            url: `/api/v1/channels/${fixture.channelId}/marketplace-connection`,
            headers,
            payload: {
                credentials: { accessToken: 'test-token' },
                configuration: {},
            },
        });
        expect(connectionRes.statusCode).toBe(201);
        const connectionId = connectionRes.json().data.id;
        const ingressToken = generateWebhookIngressToken();
        const connections = new PostgresMarketplaceConnectionRepository();
        await database.execute(async (tx) => {
            await connections.updateWebhookIngressTokenHash(tx, tenantId, connectionId, hashWebhookIngressToken(ingressToken));
        }, { tenantId });
        app.marketplaceWebhookIngestion.webhookAdapterRegistry.register(createTestMarketplaceWebhookAdapter(marketplaceKey));
        return {
            tenantId,
            headers,
            fixture,
            marketplaceKey,
            ingressToken,
        };
    }

    it('ingests order.create webhook and deduplicates replay', async () => {
        const ctx = await seedWebhookFixture();
        const payload = buildTestWebhookPayload({
            marketplaceKey: ctx.marketplaceKey,
            externalOrderId: `wh-${Date.now()}`,
            merchantSku: ctx.fixture.merchantSku,
            stockLocationId: ctx.fixture.stockLocationId,
        });
        const rawBody = JSON.stringify(payload);
        const url = `/api/v1/inbound/marketplace-webhooks/${ctx.ingressToken}`;
        const first = await server.inject({
            method: 'POST',
            url,
            headers: { 'x-test-signature': signTestWebhookBody(rawBody), 'content-type': 'application/json' },
            payload: rawBody,
        });
        expect(first.statusCode).toBe(200);
        expect(first.json().replayed).toBe(false);
        const second = await server.inject({
            method: 'POST',
            url,
            headers: { 'x-test-signature': signTestWebhookBody(rawBody), 'content-type': 'application/json' },
            payload: rawBody,
        });
        expect(second.statusCode).toBe(200);
        expect(second.json().replayed).toBe(true);
    });

    it('isolates tenants by ingress token', async () => {
        const ctxA = await seedWebhookFixture();
        const ctxB = await seedWebhookFixture();
        expect(ctxA.ingressToken).not.toBe(ctxB.ingressToken);
        const payload = buildTestWebhookPayload({
            marketplaceKey: ctxB.marketplaceKey,
            externalOrderId: `cross-tenant-${Date.now()}`,
            merchantSku: ctxB.fixture.merchantSku,
            stockLocationId: ctxB.fixture.stockLocationId,
        });
        const rawBody = JSON.stringify(payload);
        const wrongUrl = `/api/v1/inbound/marketplace-webhooks/${ctxA.ingressToken}`;
        const response = await server.inject({
            method: 'POST',
            url: wrongUrl,
            headers: { 'x-test-signature': signTestWebhookBody(rawBody), 'content-type': 'application/json' },
            payload: rawBody,
        });
        expect(response.statusCode).toBe(422);
    });
});
