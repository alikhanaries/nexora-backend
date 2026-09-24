import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/app/config/config.js';
import { RetentionCleanupError, RetentionCleanupService, } from '../../src/infrastructure/postgres/retention-cleanup-service.js';
import { WebhookDeliveryRetention } from '../../src/infrastructure/postgres/webhook-delivery-retention.js';
import { RetentionCleanupScheduler } from '../../src/infrastructure/postgres/retention-cleanup-scheduler.js';
import { closeTestInfrastructure, getTestInfrastructure } from './helpers.js';
function daysAgo(days) {
    return new Date(Date.now() - days * 86_400_000);
}
function createService(infra, overrides = {}) {
    const config = loadConfig(process.env);
    return new RetentionCleanupService(infra.outbox, infra.inbox, infra.idempotency, new WebhookDeliveryRetention(infra.database), {
        ...config.retention,
        batchSize: 2,
        ...overrides,
    }, infra.logger, infra.metrics);
}
describe('retention cleanup integration', { timeout: 120_000 }, () => {
    afterAll(async () => {
        await closeTestInfrastructure();
    });
    it('deletes old published outbox rows and preserves active rows', async () => {
        const infra = await getTestInfrastructure();
        const service = createService(infra, { outboxDays: 30, inboxDays: 30, idempotencyDays: 7 });
        const oldPublishedId = randomUUID();
        const recentPublishedId = randomUUID();
        const unpublishedId = randomUUID();
        const deadLetterId = randomUUID();
        await infra.database.query(`INSERT INTO outbox_events
       (id, event_type, event_version, aggregate_type, aggregate_id, payload, published_at, occurred_at)
       VALUES
       ($1, 'test.old_published', 1, 'test', 'a', '{}'::jsonb, $2, $2),
       ($3, 'test.recent_published', 1, 'test', 'b', '{}'::jsonb, now(), now()),
       ($4, 'test.unpublished', 1, 'test', 'c', '{}'::jsonb, NULL, now()),
       ($5, 'test.dead_letter', 1, 'test', 'd', '{}'::jsonb, NULL, now())`, [oldPublishedId, daysAgo(45), recentPublishedId, unpublishedId, deadLetterId], { operation: 'test.retention.outbox_seed' });
        await infra.database.query(`UPDATE outbox_events SET dead_lettered_at = now() WHERE id = $1`, [deadLetterId], { operation: 'test.retention.outbox_dead_letter' });
        const stats = await service.run();
        expect(stats.outboxDeleted).toBeGreaterThanOrEqual(1);
        const remaining = await infra.database.query(`SELECT id FROM outbox_events WHERE id = ANY($1::uuid[])`, [[oldPublishedId, recentPublishedId, unpublishedId, deadLetterId]], { operation: 'test.retention.outbox_verify' });
        const remainingIds = remaining.rows.map((row) => String(row['id']));
        expect(remainingIds).not.toContain(oldPublishedId);
        expect(remainingIds).toContain(recentPublishedId);
        expect(remainingIds).toContain(unpublishedId);
        expect(remainingIds).toContain(deadLetterId);
    });
    it('respects outbox batch size and eventually deletes all eligible rows', async () => {
        const infra = await getTestInfrastructure();
        const service = createService(infra, { outboxDays: 10, inboxDays: 30, idempotencyDays: 7, batchSize: 2 });
        const ids = [randomUUID(), randomUUID(), randomUUID()];
        for (const id of ids) {
            await infra.database.query(`INSERT INTO outbox_events
         (id, event_type, event_version, aggregate_type, aggregate_id, payload, published_at, occurred_at)
         VALUES ($1, 'test.batch', 1, 'test', 'batch-item', '{}'::jsonb, $2, $2)`, [id, daysAgo(20)], { operation: 'test.retention.outbox_batch_seed' });
        }
        const stats = await service.run();
        expect(stats.outboxDeleted).toBe(3);
        const remaining = await infra.database.query(`SELECT count(*)::int AS count FROM outbox_events WHERE id = ANY($1::uuid[])`, [ids], { operation: 'test.retention.outbox_batch_verify' });
        expect(remaining.rows[0]?.count).toBe(0);
    });
    it('deletes old processed inbox rows and preserves active rows', async () => {
        const infra = await getTestInfrastructure();
        const service = createService(infra, { outboxDays: 30, inboxDays: 30, idempotencyDays: 7 });
        const oldProcessedId = randomUUID();
        const recentProcessedId = randomUUID();
        const processingId = randomUUID();
        const failedId = randomUUID();
        await infra.database.query(`INSERT INTO inbox_messages (consumer_name, event_id, event_type, status, processed_at)
       VALUES
       ('retention.test', $1, 'test.old', 'processed', $2),
       ('retention.test', $3, 'test.recent', 'processed', now()),
       ('retention.test', $4, 'test.processing', 'processing', NULL),
       ('retention.test', $5, 'test.failed', 'failed', NULL)`, [oldProcessedId, daysAgo(45), recentProcessedId, processingId, failedId], { operation: 'test.retention.inbox_seed' });
        const stats = await service.run();
        expect(stats.inboxDeleted).toBeGreaterThanOrEqual(1);
        const remaining = await infra.database.query(`SELECT event_id, status FROM inbox_messages
       WHERE consumer_name = 'retention.test' AND event_id = ANY($1::uuid[])`, [[oldProcessedId, recentProcessedId, processingId, failedId]], { operation: 'test.retention.inbox_verify' });
        const byId = new Map(remaining.rows.map((row) => [String(row['event_id']), String(row['status'])]));
        expect(byId.has(oldProcessedId)).toBe(false);
        expect(byId.get(recentProcessedId)).toBe('processed');
        expect(byId.get(processingId)).toBe('processing');
        expect(byId.get(failedId)).toBe('failed');
    });
    it('deletes expired idempotency rows and preserves active rows', async () => {
        const infra = await getTestInfrastructure();
        const service = createService(infra, { outboxDays: 30, inboxDays: 30, idempotencyDays: 7 });
        const expiredKey = `expired-${randomUUID()}`;
        const recentExpiredKey = `recent-expired-${randomUUID()}`;
        const activeKey = `active-${randomUUID()}`;
        const processingKey = `processing-${randomUUID()}`;
        await infra.database.query(`INSERT INTO idempotency_records (
         tenant_id, principal_fingerprint, route_id, idempotency_key,
         request_fingerprint, status, expires_at, response_status, response_body, completed_at
       ) VALUES
       (NULL, 'test', 'POST /retention', $1, 'fp1', 'completed', $2, 200, '{}'::jsonb, $2),
       (NULL, 'test', 'POST /retention', $3, 'fp2', 'completed', $4, 200, '{}'::jsonb, $4),
       (NULL, 'test', 'POST /retention', $5, 'fp3', 'completed', now() + interval '1 day', 200, '{}'::jsonb, now()),
       (NULL, 'test', 'POST /retention', $6, 'fp4', 'processing', now() + interval '1 day', NULL, NULL, NULL)`, [
            expiredKey,
            daysAgo(20),
            recentExpiredKey,
            daysAgo(2),
            activeKey,
            processingKey,
        ], { operation: 'test.retention.idempotency_seed' });
        const stats = await service.run();
        expect(stats.idempotencyDeleted).toBeGreaterThanOrEqual(1);
        const remaining = await infra.database.query(`SELECT idempotency_key FROM idempotency_records
       WHERE route_id = 'POST /retention' AND idempotency_key = ANY($1::text[])`, [[expiredKey, recentExpiredKey, activeKey, processingKey]], { operation: 'test.retention.idempotency_verify' });
        const keys = remaining.rows.map((row) => String(row['idempotency_key']));
        expect(keys).not.toContain(expiredKey);
        expect(keys).toContain(recentExpiredKey);
        expect(keys).toContain(activeKey);
        expect(keys).toContain(processingKey);
    });
    it('allows overlapping cleanup executions without deleting active rows', async () => {
        const infra = await getTestInfrastructure();
        const service = createService(infra, { outboxDays: 30, inboxDays: 30, idempotencyDays: 7, batchSize: 1 });
        const sharedOldId = randomUUID();
        const activeId = randomUUID();
        await infra.database.query(`INSERT INTO outbox_events
       (id, event_type, event_version, aggregate_type, aggregate_id, payload, published_at, occurred_at)
       VALUES
       ($1, 'test.concurrent', 1, 'test', 'old', '{}'::jsonb, $2, $2),
       ($3, 'test.concurrent', 1, 'test', 'active', '{}'::jsonb, now(), now())`, [sharedOldId, daysAgo(60), activeId], { operation: 'test.retention.concurrent_seed' });
        const [first, second] = await Promise.all([service.run(), service.run()]);
        expect(first.outboxDeleted + second.outboxDeleted).toBeGreaterThanOrEqual(1);
        const remaining = await infra.database.query(`SELECT id FROM outbox_events WHERE id = ANY($1::uuid[])`, [[sharedOldId, activeId]], { operation: 'test.retention.concurrent_verify' });
        const remainingIds = remaining.rows.map((row) => String(row['id']));
        expect(remainingIds).not.toContain(sharedOldId);
        expect(remainingIds).toContain(activeId);
    });
    it('registers the scheduler and propagates cleanup failures', async () => {
        const infra = await getTestInfrastructure();
        const failingOutbox = {
            purgePublishedBefore: async () => {
                throw new Error('simulated outbox failure');
            },
        };
        const service = new RetentionCleanupService(failingOutbox, infra.inbox, infra.idempotency, new WebhookDeliveryRetention(infra.database), {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, infra.logger, infra.metrics);
        const scheduler = new RetentionCleanupScheduler(service, infra.lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, infra.logger, 300);
        await expect(scheduler.tick()).rejects.toBeInstanceOf(RetentionCleanupError);
        const healthyScheduler = infra.retentionCleanupScheduler;
        expect(healthyScheduler).toBeDefined();
        expect(typeof healthyScheduler.start).toBe('function');
    });
    it('deletes old terminal webhook delivery rows and preserves retryable rows', async () => {
        const infra = await getTestInfrastructure();
        const service = createService(infra, { webhookDeliveryDays: 30, batchSize: 10 });
        const tenantId = randomUUID();
        const slug = `wh-ret-${tenantId.slice(0, 8)}`;
        await infra.database.query(`INSERT INTO tenants (id, slug, name) VALUES ($1, $2, 'Webhook retention test')`, [tenantId, slug], { operation: 'test.retention.webhook_tenant' });
        const subscriptionId = randomUUID();
        await infra.database.query(`INSERT INTO webhook_subscriptions
       (id, tenant_id, url, secret_ciphertext, event_types, status)
       VALUES ($1, $2, 'https://example.com/hook', 'cipher', ARRAY['order.created'], 'ACTIVE')`, [subscriptionId, tenantId], { operation: 'test.retention.webhook_subscription' });
        const oldDeliveredId = randomUUID();
        const recentDeliveredId = randomUUID();
        const deadLetterId = randomUUID();
        const pendingId = randomUUID();
        const failedId = randomUUID();
        await infra.database.query(`INSERT INTO webhook_deliveries
       (id, tenant_id, subscription_id, event_id, event_type, status, attempt_count, delivered_at, created_at)
       VALUES
       ($1, $2, $3, $4, 'order.created', 'DELIVERED', 1, $5, $5),
       ($6, $2, $3, $7, 'order.created', 'DELIVERED', 1, now(), now()),
       ($8, $2, $3, $9, 'order.created', 'DEAD_LETTERED', 3, NULL, $10),
       ($11, $2, $3, $12, 'order.created', 'PENDING', 0, NULL, now()),
       ($13, $2, $3, $14, 'order.created', 'FAILED', 1, NULL, now())`, [
            oldDeliveredId,
            tenantId,
            subscriptionId,
            randomUUID(),
            daysAgo(45),
            recentDeliveredId,
            randomUUID(),
            deadLetterId,
            randomUUID(),
            daysAgo(45),
            pendingId,
            randomUUID(),
            failedId,
            randomUUID(),
        ], { operation: 'test.retention.webhook_deliveries_seed' });
        const stats = await service.run();
        expect(stats.webhookDeliveriesDeleted).toBeGreaterThanOrEqual(2);
        const remaining = await infra.database.query(`SELECT id, status FROM webhook_deliveries
       WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, [oldDeliveredId, recentDeliveredId, deadLetterId, pendingId, failedId]], { operation: 'test.retention.webhook_deliveries_verify' });
        const byId = new Map(remaining.rows.map((row) => [String(row['id']), String(row['status'])]));
        expect(byId.has(oldDeliveredId)).toBe(false);
        expect(byId.has(deadLetterId)).toBe(false);
        expect(byId.get(recentDeliveredId)).toBe('DELIVERED');
        expect(byId.get(pendingId)).toBe('PENDING');
        expect(byId.get(failedId)).toBe('FAILED');
    });
});
