import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { AesSecretEncryptor } from '../../src/infrastructure/auth/aes-secret-encryptor.js';
import { createWebhookDeliveryService, createWebhookDispatchService } from '../../src/modules/webhooks/index.js';
import { verifyWebhookRequestBody } from '../../src/modules/webhooks/application/webhook-request-signer.js';
import { WebhookDeliveryRetryError } from '../../src/modules/webhooks/application/webhook-delivery-errors.js';
import { createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

async function seedOutboxEvent(infra, tenantId, event) {
    await infra.database.execute(async (tx) => {
        await infra.outbox.record(tx, {
            id: event.id,
            type: event.type,
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId,
            payload: event.payload,
            correlationId: null,
            occurredAt: event.occurredAt,
        });
    });
}

function buildDeliveryContext(attempt = 1, maxAttempts = 5) {
    return {
        id: 'job-1',
        name: 'deliver-webhook',
        queue: 'webhook-deliveries',
        attempt,
        maxAttempts,
    };
}

describe('webhook delivery worker integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('delivers a webhook, verifies the signature, and marks the delivery DELIVERED', async () => {
        const infra = await getTestInfrastructure();
        const config = loadConfig(process.env);
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/nexora',
            eventTypes: ['order.created'],
        });
        const eventId = randomUUID();
        await seedOutboxEvent(infra, tenant.tenantId, {
            id: eventId,
            type: 'order.created',
            payload: { orderNumber: 'ORD-100' },
            occurredAt: new Date('2026-01-02T00:00:00.000Z'),
        });
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        await dispatch.dispatch({
            id: eventId,
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId: tenant.tenantId,
            payload: { orderNumber: 'ORD-100' },
            occurredAt: new Date('2026-01-02T00:00:00.000Z'),
            correlationId: null,
        });
        const deliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, created.subscription.id), { tenantId: tenant.tenantId });
        const delivery = deliveries[0];
        /** @type {import('../../src/infrastructure/http/fetch-http-client.js').FetchHttpClient['send'] | undefined} */
        let capturedRequest;
        const deliveryService = createWebhookDeliveryService({
            database: infra.database,
            outbox: infra.outbox,
            httpClient: {
                send: vi.fn(async (request) => {
                    capturedRequest = request;
                    return { status: 200, headers: {}, body: null, durationMs: 5, ok: true };
                }),
            },
            secretEncryptor: new AesSecretEncryptor(config.auth.mfaEncryptionKey),
            logger: infra.logger,
            metrics: infra.metrics,
            config,
            ssrfValidator: async (url) => new URL(url),
        });
        await deliveryService.deliver({
            tenantId: tenant.tenantId,
            deliveryId: delivery.id,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        }, buildDeliveryContext());
        expect(capturedRequest?.headers['X-Nexora-Signature']).toMatch(/^v1=/);
        expect(capturedRequest?.body).toContain('"orderNumber":"ORD-100"');
        expect(verifyWebhookRequestBody(created.secret, capturedRequest.body, capturedRequest.headers['X-Nexora-Signature'])).toBe(true);
        const updated = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.findById(tx, tenant.tenantId, delivery.id), { tenantId: tenant.tenantId });
        expect(updated?.status).toBe('DELIVERED');
        expect(updated?.lastHttpStatus).toBe(200);
        expect(updated?.deliveredAt).not.toBeNull();
        await app.httpServer.close();
    });

    it('dead-letters disabled subscriptions without HTTP', async () => {
        const infra = await getTestInfrastructure();
        const config = loadConfig(process.env);
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/nexora',
            eventTypes: ['order.created'],
        });
        await app.webhooks.webhookCommandService.updateWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: created.subscription.id,
            status: 'DISABLED',
        });
        const eventId = randomUUID();
        const delivery = await app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenant.tenantId,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        });
        const httpClient = { send: vi.fn() };
        const deliveryService = createWebhookDeliveryService({
            database: infra.database,
            outbox: infra.outbox,
            httpClient,
            secretEncryptor: new AesSecretEncryptor(config.auth.mfaEncryptionKey),
            logger: infra.logger,
            metrics: infra.metrics,
            config,
            ssrfValidator: async (url) => new URL(url),
        });
        await deliveryService.deliver({
            tenantId: tenant.tenantId,
            deliveryId: delivery.delivery.id,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        }, buildDeliveryContext());
        expect(httpClient.send).not.toHaveBeenCalled();
        const updated = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.findById(tx, tenant.tenantId, delivery.delivery.id), { tenantId: tenant.tenantId });
        expect(updated?.status).toBe('DEAD_LETTERED');
        await app.httpServer.close();
    });

    it('retries retryable failures and dead-letters after max attempts', async () => {
        const infra = await getTestInfrastructure();
        const config = loadConfig(process.env);
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/nexora',
            eventTypes: ['order.created'],
        });
        const eventId = randomUUID();
        await seedOutboxEvent(infra, tenant.tenantId, {
            id: eventId,
            type: 'order.created',
            payload: {},
            occurredAt: new Date(),
        });
        const delivery = await app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenant.tenantId,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        });
        const deliveryService = createWebhookDeliveryService({
            database: infra.database,
            outbox: infra.outbox,
            httpClient: {
                send: vi.fn(async () => ({ status: 500, headers: {}, body: null, durationMs: 5, ok: false })),
            },
            secretEncryptor: new AesSecretEncryptor(config.auth.mfaEncryptionKey),
            logger: infra.logger,
            metrics: infra.metrics,
            config,
            ssrfValidator: async (url) => new URL(url),
        });
        await expect(deliveryService.deliver({
            tenantId: tenant.tenantId,
            deliveryId: delivery.delivery.id,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        }, buildDeliveryContext(1, 5))).rejects.toBeInstanceOf(WebhookDeliveryRetryError);
        await deliveryService.deliver({
            tenantId: tenant.tenantId,
            deliveryId: delivery.delivery.id,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        }, buildDeliveryContext(5, 5));
        const updated = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.findById(tx, tenant.tenantId, delivery.delivery.id), { tenantId: tenant.tenantId });
        expect(updated?.status).toBe('DEAD_LETTERED');
        expect(updated?.attemptCount).toBeGreaterThan(0);
        await app.httpServer.close();
    });
});
