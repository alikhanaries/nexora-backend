import { afterAll, describe, expect, it } from 'vitest';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

describe('Phase 11 commerce webhook catalog expansion integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates subscriptions for offer, channel, and price events', async () => {
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
            url: 'https://example.com/webhooks/commerce',
            eventTypes: ['offer.created', 'channel.updated', 'price.changed'],
        });

        expect(created.subscription.eventTypes).toEqual([
            'offer.created',
            'channel.updated',
            'price.changed',
        ]);
    });

    it('still rejects marketplace events for webhook subscriptions', async () => {
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
            url: 'https://example.com/webhooks/bad',
            eventTypes: ['marketplace.created'],
        })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
});
