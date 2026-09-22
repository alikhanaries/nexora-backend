import { Queue } from 'bullmq';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { createApplication } from '../../src/app/bootstrap/create-application.js';
import { JobName, QueueName } from '../../src/infrastructure/queue/queue-names.js';
import { createWebhookDispatchService } from '../../src/modules/webhooks/index.js';
import { createIntegrationEventConsumers } from '../../src/workers/create-integration-event-consumers.js';
import { createAuthenticatedUser, createTestTenant, authHeaders } from './auth-helpers.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';

const WEBHOOK_PERMISSIONS = ['webhooks.read', 'webhooks.manage'];

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

async function findLatestOutboxEvent(infra, tenantId, eventType) {
    const result = await infra.database.query(
        `SELECT id, event_type, event_version, aggregate_type, aggregate_id,
                tenant_id, payload, correlation_id, occurred_at
         FROM outbox_events
         WHERE tenant_id = $1 AND event_type = $2
         ORDER BY occurred_at DESC
         LIMIT 1`,
        [tenantId, eventType],
        { operation: 'test.webhook_catalog.latest_outbox_event' },
    );
    return result.rows[0] ?? null;
}

function toIntegrationEvent(row) {
    return {
        id: row.id,
        type: row.event_type,
        version: row.event_version,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        tenantId: row.tenant_id,
        payload: row.payload,
        correlationId: row.correlation_id,
        occurredAt: row.occurred_at,
    };
}

describe('Phase 7.5 webhook catalog expansion integration', () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });

    it('creates subscriptions for product and inventory events', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);

        const productSubscription = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/product',
            eventTypes: ['product.created'],
        });
        expect(productSubscription.subscription.eventTypes).toEqual(['product.created']);

        const inventorySubscription = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/inventory',
            eventTypes: ['inventory.inventory_changed'],
        });
        expect(inventorySubscription.subscription.eventTypes).toEqual(['inventory.inventory_changed']);

        await app.httpServer.close();
    });

    it('updates a subscription to newly allowed product events', async () => {
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
            url: 'https://example.com/webhooks/update',
            eventTypes: ['order.created'],
        });
        const updated = await app.webhooks.webhookCommandService.updateWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            subscriptionId: created.subscription.id,
            eventTypes: ['product.updated', 'product.status_changed'],
        });
        expect(updated.subscription.eventTypes).toEqual(['product.updated', 'product.status_changed']);
        await app.httpServer.close();
    });

    it('routes product.created from outbox through integration dispatch to webhook delivery', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const headers = authHeaders(user.accessToken);
        const suffix = randomBytes(6).toString('hex');
        const created = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/product-created',
            eventTypes: ['product.created'],
        });
        const productRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/products',
            headers,
            payload: { merchantSku: `SKU-${suffix}`, productType: 'STANDARD' },
        });
        expect(productRes.statusCode).toBe(201);

        const outboxRow = await findLatestOutboxEvent(infra, tenant.tenantId, 'product.created');
        expect(outboxRow).not.toBeNull();

        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        const { integrationEventRouter } = createIntegrationEventConsumers({
            database: infra.database,
            inbox: infra.inbox,
            logger: infra.logger,
            webhookDispatchService: dispatch,
        });
        const event = toIntegrationEvent(outboxRow);
        await integrationEventRouter.route(event);

        const deliveries = await infra.database.execute(
            (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, created.subscription.id),
            { tenantId: tenant.tenantId },
        );
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].eventType).toBe('product.created');
        expect(deliveries[0].status).toBe('PENDING');

        const job = await getWebhookDeliveryJob(infra, `${created.subscription.id}_${event.id}`);
        expect(job?.name).toBe(JobName.DELIVER_WEBHOOK);
        expect(job?.data.eventType).toBe('product.created');
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${created.subscription.id}_${event.id}`);
        await app.httpServer.close();
    });

    it('routes inventory.inventory_changed from outbox through integration dispatch to webhook delivery', async () => {
        const infra = await getTestInfrastructure();
        const app = await createApplication(infra);
        await app.httpServer.ready();
        const tenant = await createTestTenant(app.httpServer);
        const user = await createAuthenticatedUser(app, tenant.tenantId, tenant.slug);
        const headers = authHeaders(user.accessToken);
        const suffix = randomBytes(6).toString('hex');

        const productRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/products',
            headers,
            payload: { merchantSku: `SKU-${suffix}`, productType: 'STANDARD' },
        });
        expect(productRes.statusCode).toBe(201);
        const productId = productRes.json().data.id;

        const locationRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/stock-locations',
            headers,
            payload: { name: `Warehouse-${suffix}` },
        });
        expect(locationRes.statusCode).toBe(201);
        const stockLocationId = locationRes.json().data.id;

        const created = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenant.tenantId,
            actorId: user.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/inventory-changed',
            eventTypes: ['inventory.inventory_changed'],
        });

        const receiptRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/inventory/receipts',
            headers,
            payload: {
                stockLocationId,
                productId,
                quantity: 5,
                referenceType: 'TEST',
                referenceId: `receipt-${suffix}`,
            },
        });
        expect(receiptRes.statusCode).toBe(200);

        const outboxRow = await findLatestOutboxEvent(infra, tenant.tenantId, 'inventory.inventory_changed');
        expect(outboxRow).not.toBeNull();

        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        const { integrationEventRouter } = createIntegrationEventConsumers({
            database: infra.database,
            inbox: infra.inbox,
            logger: infra.logger,
            webhookDispatchService: dispatch,
        });
        const event = toIntegrationEvent(outboxRow);
        await integrationEventRouter.route(event);
        await integrationEventRouter.route(event);

        const deliveries = await infra.database.execute(
            (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenant.tenantId, created.subscription.id),
            { tenantId: tenant.tenantId },
        );
        expect(deliveries).toHaveLength(1);

        const webhookInbox = await infra.database.query(
            `SELECT status FROM inbox_messages
             WHERE consumer_name = $1 AND event_id = $2`,
            ['webhooks.dispatch-enqueue', event.id],
            { operation: 'test.webhook_catalog.inbox' },
        );
        expect(webhookInbox.rows[0]?.status).toBe('processed');
        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${created.subscription.id}_${event.id}`);
        await app.httpServer.close();
    });

    it('does not deliver tenant A product events to tenant B subscriptions', async () => {
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
            url: 'https://example.com/webhooks/tenant-a-product',
            eventTypes: ['product.created'],
        });
        const subB = await app.webhooks.webhookCommandService.createWebhookSubscription({
            tenantId: tenantB.tenantId,
            actorId: userB.userId,
            actorKind: 'user',
            actorPermissions: WEBHOOK_PERMISSIONS,
            url: 'https://example.com/webhooks/tenant-b-product',
            eventTypes: ['product.created'],
        });

        const productRes = await app.httpServer.inject({
            method: 'POST',
            url: '/api/v1/products',
            headers: authHeaders(userA.accessToken),
            payload: { merchantSku: `SKU-${randomBytes(4).toString('hex')}`, productType: 'STANDARD' },
        });
        expect(productRes.statusCode).toBe(201);

        const outboxRow = await findLatestOutboxEvent(infra, tenantA.tenantId, 'product.created');
        expect(outboxRow).not.toBeNull();

        const dispatch = createWebhookDispatchService({ database: infra.database, queue: infra.queue });
        await dispatch.dispatch(toIntegrationEvent(outboxRow));

        const deliveriesA = await infra.database.execute(
            (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenantA.tenantId, subA.subscription.id),
            { tenantId: tenantA.tenantId },
        );
        const deliveriesB = await infra.database.execute(
            (tx) => app.webhooks.repositories.deliveries.listBySubscription(tx, tenantB.tenantId, subB.subscription.id),
            { tenantId: tenantB.tenantId },
        );
        expect(deliveriesA).toHaveLength(1);
        expect(deliveriesB).toHaveLength(0);

        await infra.queue.remove(QueueName.WEBHOOK_DELIVERIES, `${subA.subscription.id}_${outboxRow.id}`);
        await app.httpServer.close();
    });
});
