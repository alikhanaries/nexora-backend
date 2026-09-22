import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { JobName, QueueName } from '../../src/infrastructure/queue/queue-names.js';
import { createWebhookDispatchService } from '../../src/modules/webhooks/index.js';
import { createIntegrationEventConsumers } from '../../src/workers/create-integration-event-consumers.js';
import { createAuthenticatedUser, createTestTenant } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

function buildEvent(overrides = {}) {
    return {
        id: randomUUID(),
        type: 'order.created',
        version: 1,
        aggregateType: 'order',
        aggregateId: randomUUID(),
        payload: { orderNumber: 'ORD-1' },
        correlationId: null,
        occurredAt: new Date(),
        ...overrides,
    };
}

async function getWebhookDeliveryJob(infra, jobId) {
    const config = loadConfig(process.env);
    const queue = new Queue(QueueName.WEBHOOK_DELIVERIES, {
        connection: infra.queueConnection,
        prefix: config.queue.prefix,
    });
    try {
        return await queue.getJob(jobId);
    }
    finally {
        await queue.close();
    }
}

describe('webhook dispatch enqueue integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates a pending delivery and enqueues identifier-only job data', async () => {
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
        const event = buildEvent({ tenantId: tenant.tenantId });
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        const result = await dispatch.dispatch(event);
        expect(result.deliveriesEnsured).toBe(1);
        expect(result.jobsEnqueued).toBe(1);
        const deliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, created.subscription.id), { tenantId: tenant.tenantId });
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].status).toBe('PENDING');
        expect(deliveries[0].attemptCount).toBe(0);
        expect(deliveries[0].eventId).toBe(event.id);
        const job = await getWebhookDeliveryJob(infra, `${created.subscription.id}_${event.id}`);
        expect(job?.name).toBe(JobName.DELIVER_WEBHOOK);
        expect(job?.data).toEqual({
            tenantId: tenant.tenantId,
            deliveryId: deliveries[0].id,
            subscriptionId: created.subscription.id,
            eventId: event.id,
            eventType: 'order.created',
        });
        expect(job?.data).not.toHaveProperty('secret');
        expect(job?.data).not.toHaveProperty('secretCiphertext');
        expect(job?.data).not.toHaveProperty('payload');
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${created.subscription.id}_${event.id}`);
        await app.httpServer.close();
    });

    it('ignores non-deliverable events and inactive subscriptions', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const active = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/active',
            eventTypes: ['shipment.shipped'],
        });
        const disabled = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/disabled',
            eventTypes: ['order.created'],
        });
        await app.webhooks.webhookCommandService.updateWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: disabled.subscription.id,
            status: 'DISABLED',
        });
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        const ignored = await dispatch.dispatch(buildEvent({
            tenantId: tenant.tenantId,
            type: 'foundation.test_event',
        }));
        expect(ignored).toEqual({ deliveriesEnsured: 0, jobsEnqueued: 0 });
        const wrongType = await dispatch.dispatch(buildEvent({
            tenantId: tenant.tenantId,
            type: 'order.created',
        }));
        expect(wrongType).toEqual({ deliveriesEnsured: 0, jobsEnqueued: 0 });
        const disabledResult = await dispatch.dispatch(buildEvent({
            tenantId: tenant.tenantId,
            type: 'order.created',
        }));
        expect(disabledResult).toEqual({ deliveriesEnsured: 0, jobsEnqueued: 0 });
        const activeResult = await dispatch.dispatch(buildEvent({
            tenantId: tenant.tenantId,
            type: 'shipment.shipped',
        }));
        expect(activeResult.deliveriesEnsured).toBe(1);
        const activeDeliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, active.subscription.id), { tenantId: tenant.tenantId });
        expect(activeDeliveries).toHaveLength(1);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${active.subscription.id}_${activeDeliveries[0].eventId}`);
        await app.httpServer.close();
    });

    it('is idempotent for duplicate and concurrent processing', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const first = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/one',
            eventTypes: ['order.created'],
        });
        const second = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/two',
            eventTypes: ['order.created'],
        });
        const event = buildEvent({ tenantId: tenant.tenantId });
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        await Promise.all([
            dispatch.dispatch(event),
            dispatch.dispatch(event),
        ]);
        await dispatch.dispatch(event);
        const firstDeliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, first.subscription.id), { tenantId: tenant.tenantId });
        const secondDeliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, second.subscription.id), { tenantId: tenant.tenantId });
        expect(firstDeliveries).toHaveLength(1);
        expect(secondDeliveries).toHaveLength(1);
        const otherEvent = buildEvent({ tenantId: tenant.tenantId });
        await dispatch.dispatch(otherEvent);
        expect(await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, first.subscription.id), { tenantId: tenant.tenantId })).toHaveLength(2);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${first.subscription.id}_${event.id}`);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${second.subscription.id}_${event.id}`);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${first.subscription.id}_${otherEvent.id}`);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${second.subscription.id}_${otherEvent.id}`);
        await app.httpServer.close();
    });

    it('selects only subscriptions for the event tenant', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenantA = await createTestTenant(app.httpServer);
        const tenantB = await createTestTenant(app.httpServer);
        const userA = await createAuthenticatedUser(app, tenantA.tenantId, tenantA.slug);
        const userB = await createAuthenticatedUser(app, tenantB.tenantId, tenantB.slug);
        const subA = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenantA.tenantId,
            actorId: userA.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/tenant-a',
            eventTypes: ['order.created'],
        });
        const subB = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenantB.tenantId,
            actorId: userB.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/tenant-b',
            eventTypes: ['order.created'],
        });
        const event = buildEvent({ tenantId: tenantA.tenantId });
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        await dispatch.dispatch(event);
        const deliveriesA = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenantA.tenantId, subA.subscription.id), { tenantId: tenantA.tenantId });
        const deliveriesB = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenantB.tenantId, subB.subscription.id), { tenantId: tenantB.tenantId });
        expect(deliveriesA).toHaveLength(1);
        expect(deliveriesB).toHaveLength(0);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${subA.subscription.id}_${event.id}`);
        await app.httpServer.close();
    });

    it('routes integration events through logging and webhook handlers', async () => {
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
            url: 'https://example.com/webhooks/router',
            eventTypes: ['order.created'],
        });
        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        const { integrationEventRouter } = createIntegrationEventConsumers({
            database: infra.database,
            inbox: infra.inbox,
            logger: infra.logger,
            webhookDispatchService: dispatch,
        });
        const event = buildEvent({ tenantId: tenant.tenantId });
        await integrationEventRouter.route(event);
        await integrationEventRouter.route(event);
        const logging = await infra.database.query(`SELECT status
       FROM inbox_messages
       WHERE consumer_name = $1 AND event_id = $2`, ['foundation.logging', event.id], { operation: 'test.inbox.logging' });
        const webhook = await infra.database.query(`SELECT status
       FROM inbox_messages
       WHERE consumer_name = $1 AND event_id = $2`, ['webhooks.dispatch-enqueue', event.id], { operation: 'test.inbox.webhook' });
        expect(logging.rows[0]?.status).toBe('processed');
        expect(webhook.rows[0]?.status).toBe('processed');
        const deliveries = await infra.database.execute(async (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, created.subscription.id), { tenantId: tenant.tenantId });
        expect(deliveries).toHaveLength(1);
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${created.subscription.id}_${event.id}`);
        await app.httpServer.close();
    });
});
