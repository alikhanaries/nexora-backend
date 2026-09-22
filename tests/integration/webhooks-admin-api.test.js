import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { AesSecretEncryptor } from '../../src/infrastructure/auth/aes-secret-encryptor.js';
import { createWebhookDeliveryService, createWebhookDispatchService } from '../../src/modules/webhooks/index.js';
import { verifyWebhookRequestBody } from '../../src/modules/webhooks/application/webhook-request-signer.js';
import { authHeaders, createAuthenticatedUser, createAuthenticatedUserWithSystemRole, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

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

async function recordStepUp(app, user, tenantId) {
    const payload = await app.identity.auth.accessTokenService.verify(user.accessToken);
    await app.mfa.stepUpService.recordStepUp({
        userId: user.userId,
        tenantId,
        sessionId: payload.sessionId,
    });
}

describe('webhooks admin api integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates a webhook and returns the secret exactly once', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const response = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/webhooks/nexora',
                description: 'Order events',
                eventTypes: ['order.created', 'order.status_changed'],
            },
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.success).toBe(true);
        expect(body.data.secret).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(body.data.url).toBe('https://example.com/webhooks/nexora');
        expect(body.data).not.toHaveProperty('secretCiphertext');
        const row = await infra.database.execute(async (tx) => {
            const result = await tx.query('SELECT secret_ciphertext FROM webhook_subscriptions WHERE id = $1', [body.data.id]);
            return result.rows[0];
        }, { tenantId: tenant.tenantId });
        expect(row.secret_ciphertext).not.toBe(body.data.secret);
        await app.httpServer.close();
    });

    it('does not expose secrets on GET or LIST', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/webhooks/read-test',
                eventTypes: ['order.created'],
            },
        });
        const subscriptionId = created.json().data.id;
        const getResponse = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(user.accessToken),
        });
        expect(getResponse.statusCode).toBe(200);
        expect(getResponse.json().data).not.toHaveProperty('secret');
        expect(getResponse.json().data).not.toHaveProperty('secretCiphertext');
        const listResponse = await app.httpServer.inject({
            method: 'GET',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
        });
        expect(listResponse.statusCode).toBe(200);
        for (const item of listResponse.json().data.items) {
            expect(item).not.toHaveProperty('secret');
            expect(item).not.toHaveProperty('secretCiphertext');
        }
        await app.httpServer.close();
    });

    it('rejects unsafe webhook URLs and non-deliverable event types', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const unsafeUrl = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://localhost/hook',
                eventTypes: ['order.created'],
            },
        });
        expect(unsafeUrl.statusCode).toBe(400);
        const invalidEvent = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['product.created'],
            },
        });
        expect(invalidEvent.statusCode).toBe(400);
        await app.httpServer.close();
    });

    it('rejects SSRF-unsafe URL updates', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['order.created'],
            },
        });
        const subscriptionId = created.json().data.id;
        const updated = await app.httpServer.inject({
            method: 'PATCH',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://127.0.0.1/hook',
            },
        });
        expect(updated.statusCode).toBe(400);
        await app.httpServer.close();
    });

    it('requires webhooks.manage to mutate and webhooks.read to read', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const viewer = await createAuthenticatedUserWithSystemRole(app, tenant.tenantId, tenant.slug, 'viewer');
        const operator = await createAuthenticatedUserWithSystemRole(app, tenant.tenantId, tenant.slug, 'fulfillment_operator');
        const owner = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(owner.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['order.created'],
            },
        });
        const subscriptionId = created.json().data.id;
        const readAllowed = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(viewer.accessToken),
        });
        expect(readAllowed.statusCode).toBe(200);
        const readDenied = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(operator.accessToken),
        });
        expect(readDenied.statusCode).toBe(403);
        const mutateDenied = await app.httpServer.inject({
            method: 'PATCH',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(viewer.accessToken),
            payload: { description: 'blocked' },
        });
        expect(mutateDenied.statusCode).toBe(403);
        await app.httpServer.close();
    });

    it('rejects cross-tenant subscription and delivery access', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(userA.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['order.created'],
            },
        });
        const subscriptionId = created.json().data.id;
        const crossGet = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(userB.accessToken),
        });
        expect(crossGet.statusCode).toBe(404);
        const delivery = await app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenantA.tenantId,
            subscriptionId,
            eventId: randomUUID(),
            eventType: 'order.created',
        });
        const crossDeliveries = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}/deliveries`,
            headers: authHeaders(userB.accessToken),
        });
        expect(crossDeliveries.statusCode).toBe(404);
        const crossDelivery = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}/deliveries/${delivery.delivery.id}`,
            headers: authHeaders(userB.accessToken),
        });
        expect(crossDelivery.statusCode).toBe(404);
        await app.httpServer.close();
    });

    it('requires step-up authentication to rotate secrets', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['order.created'],
            },
        });
        const subscriptionId = created.json().data.id;
        const withoutStepUp = await app.httpServer.inject({
            method: 'POST',
            url: `/api/v1/webhooks/${subscriptionId}/rotate-secret`,
            headers: authHeaders(user.accessToken),
        });
        expect(withoutStepUp.statusCode).toBe(403);
        await recordStepUp(app, user, tenant.tenantId);
        const rotated = await app.httpServer.inject({
            method: 'POST',
            url: `/api/v1/webhooks/${subscriptionId}/rotate-secret`,
            headers: authHeaders(user.accessToken),
        });
        expect(rotated.statusCode).toBe(200);
        expect(rotated.json().data.secret).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(rotated.json().data.subscription).not.toHaveProperty('secret');
        await app.httpServer.close();
    });

    it('uses the new secret for signing and stops accepting the old secret after rotation', async () => {
        const infra = await getTestInfrastructure();
        const config = loadConfig(process.env);
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['order.created'],
            },
        });
        const oldSecret = created.json().data.secret;
        const subscriptionId = created.json().data.id;
        await recordStepUp(app, user, tenant.tenantId);
        const rotated = await app.httpServer.inject({
            method: 'POST',
            url: `/api/v1/webhooks/${subscriptionId}/rotate-secret`,
            headers: authHeaders(user.accessToken),
        });
        const newSecret = rotated.json().data.secret;
        expect(newSecret).not.toBe(oldSecret);
        const eventId = randomUUID();
        await seedOutboxEvent(infra, tenant.tenantId, {
            id: eventId,
            type: 'order.created',
            payload: { orderNumber: 'ORD-200' },
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
            payload: { orderNumber: 'ORD-200' },
            occurredAt: new Date('2026-01-02T00:00:00.000Z'),
            correlationId: null,
        });
        const deliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, subscriptionId), { tenantId: tenant.tenantId });
        const delivery = deliveries[0];
        let capturedBody;
        let capturedSignature;
        const deliveryService = createWebhookDeliveryService({
            database: infra.database,
            outbox: infra.outbox,
            httpClient: {
                send: vi.fn(async (request) => {
                    capturedBody = request.body;
                    capturedSignature = request.headers['X-Nexora-Signature'];
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
            subscriptionId,
            eventId,
            eventType: 'order.created',
        }, { id: 'job-1', name: 'deliver-webhook', queue: 'webhook-deliveries', attempt: 1, maxAttempts: 5 });
        expect(verifyWebhookRequestBody(newSecret, capturedBody, capturedSignature)).toBe(true);
        expect(verifyWebhookRequestBody(oldSecret, capturedBody, capturedSignature)).toBe(false);
        await app.httpServer.close();
    });

    it('prevents new deliveries after DELETE while keeping delivery history readable', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const created = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/webhooks',
            headers: authHeaders(user.accessToken),
            payload: {
                url: 'https://example.com/hook',
                eventTypes: ['order.created'],
            },
        });
        const subscriptionId = created.json().data.id;
        const eventId = randomUUID();
        const delivery = await app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenant.tenantId,
            subscriptionId,
            eventId,
            eventType: 'order.created',
        });
        const deleted = await app.httpServer.inject({
            method: 'DELETE',
            url: `/api/v1/webhooks/${subscriptionId}`,
            headers: authHeaders(user.accessToken),
        });
        expect(deleted.statusCode).toBe(200);
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        await dispatch.dispatch({
            id: randomUUID(),
            type: 'order.created',
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId: tenant.tenantId,
            payload: { orderNumber: 'ORD-300' },
            occurredAt: new Date('2026-01-03T00:00:00.000Z'),
            correlationId: null,
        });
        const deliveriesAfterDelete = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, subscriptionId), { tenantId: tenant.tenantId });
        expect(deliveriesAfterDelete).toHaveLength(1);
        const history = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}/deliveries`,
            headers: authHeaders(user.accessToken),
        });
        expect(history.statusCode).toBe(200);
        expect(history.json().data.items).toHaveLength(1);
        const singleDelivery = await app.httpServer.inject({
            method: 'GET',
            url: `/api/v1/webhooks/${subscriptionId}/deliveries/${delivery.delivery.id}`,
            headers: authHeaders(user.accessToken),
        });
        expect(singleDelivery.statusCode).toBe(200);
        expect(singleDelivery.json().data.id).toBe(delivery.delivery.id);
        await app.httpServer.close();
    });
});
