import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { ValidationError } from '../../src/shared/errors/index.js';
import { createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

describe('webhook persistence integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates, reads, updates, disables, and deletes webhook subscriptions', async () => {
        const infra = await getTestInfrastructure();
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
            description: 'ERP notifications',
            eventTypes: ['order.created', 'shipment.shipped'],
        });
        expect(created.secret).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(created.subscription.url).toBe('https://example.com/webhooks/nexora');
        expect(created.subscription.eventTypes).toEqual(['order.created', 'shipment.shipped']);
        expect(created.subscription).not.toHaveProperty('secretCiphertext');
        const fetched = await app.webhooks.webhookQueryService.getWebhookSubscription({
            tenantId: tenant.tenantId,
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: created.subscription.id,
        });
        expect(fetched.subscription.id).toBe(created.subscription.id);
        const updated = await app.webhooks.webhookCommandService.updateWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: created.subscription.id,
            description: 'Updated label',
            status: 'DISABLED',
        });
        expect(updated.subscription.status).toBe('DISABLED');
        expect(updated.subscription.description).toBe('Updated label');
        const listed = await app.webhooks.webhookQueryService.listWebhookSubscriptions({
            tenantId: tenant.tenantId,
            actorPermissions: WEBHOOK_PERMISSIONS,
        });
        expect(listed.items.some((item) => item.id === created.subscription.id)).toBe(true);
        const deleted = await app.webhooks.webhookCommandService.deleteWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: created.subscription.id,
        });
        expect(deleted.subscription.status).toBe('DELETED');
        await app.httpServer.close();
    });

    it('rejects non-deliverable event types at subscription creation', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        await expect(app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/nexora',
            eventTypes: ['product.created'],
        })).rejects.toBeInstanceOf(ValidationError);
        await app.httpServer.close();
    });

    it('enforces unique delivery rows per subscription and event', async () => {
        const infra = await getTestInfrastructure();
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
        const first = await app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenant.tenantId,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        });
        expect(first.delivery.status).toBe('PENDING');
        await expect(app.webhooks.webhookCommandService.createWebhookDelivery({
            tenantId: tenant.tenantId,
            subscriptionId: created.subscription.id,
            eventId,
            eventType: 'order.created',
        })).rejects.toThrow();
        await app.httpServer.close();
    });
});
