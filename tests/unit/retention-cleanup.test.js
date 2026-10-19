import { describe, expect, it, vi } from 'vitest';
import { computeRetentionCutoff, RetentionCleanupError, RetentionCleanupService, } from '../../src/infrastructure/postgres/retention-cleanup-service.js';
import { RetentionCleanupScheduler } from '../../src/infrastructure/postgres/retention-cleanup-scheduler.js';
import { WebhookDeliveryRetention } from '../../src/infrastructure/postgres/webhook-delivery-retention.js';
describe('computeRetentionCutoff', () => {
    it('subtracts whole retention days from the reference time', () => {
        const now = new Date('2026-01-31T12:00:00.000Z');
        const cutoff = computeRetentionCutoff(30, now);
        expect(cutoff.toISOString()).toBe('2026-01-01T12:00:00.000Z');
    });
});
describe('RetentionCleanupService', () => {
    it('purges each resource in bounded batches until a partial batch', async () => {
        const outbox = { purgePublishedBefore: vi.fn()
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(1), };
        const inbox = { purgeProcessedBefore: vi.fn().mockResolvedValueOnce(1), };
        const idempotency = { purgeExpiredBefore: vi.fn().mockResolvedValue(0), };
        const webhookDeliveries = { purgeTerminalBefore: vi.fn().mockResolvedValue(0), };
        const logger = {
            info: vi.fn(),
            error: vi.fn(),
        };
        const service = new RetentionCleanupService(outbox, inbox, idempotency, webhookDeliveries, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 2,
            intervalMs: 60_000,
        }, logger, undefined);
        const now = new Date('2026-02-01T00:00:00.000Z');
        const stats = await service.run(now);
        expect(stats).toEqual({
            outboxDeleted: 5,
            inboxDeleted: 1,
            idempotencyDeleted: 0,
            webhookDeliveriesDeleted: 0,
        });
        expect(outbox.purgePublishedBefore).toHaveBeenCalledTimes(3);
        expect(inbox.purgeProcessedBefore).toHaveBeenCalledTimes(1);
        expect(idempotency.purgeExpiredBefore).toHaveBeenCalledTimes(1);
        expect(webhookDeliveries.purgeTerminalBefore).toHaveBeenCalledTimes(1);
        expect(outbox.purgePublishedBefore.mock.calls[0]?.[0].toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });
    it('continues other resources when one category fails and reports aggregate failure', async () => {
        const outbox = { purgePublishedBefore: vi.fn().mockResolvedValue(1), };
        const inbox = { purgeProcessedBefore: vi.fn().mockRejectedValue(new Error('inbox failed')), };
        const idempotency = { purgeExpiredBefore: vi.fn().mockResolvedValue(2), };
        const webhookDeliveries = { purgeTerminalBefore: vi.fn().mockResolvedValue(0), };
        const logger = {
            info: vi.fn(),
            error: vi.fn(),
        };
        const service = new RetentionCleanupService(outbox, inbox, idempotency, webhookDeliveries, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, undefined);
        await expect(service.run()).rejects.toBeInstanceOf(RetentionCleanupError);
        expect(outbox.purgePublishedBefore).toHaveBeenCalled();
        expect(idempotency.purgeExpiredBefore).toHaveBeenCalled();
        expect(webhookDeliveries.purgeTerminalBefore).toHaveBeenCalled();
    });
});
describe('RetentionCleanupScheduler', () => {
    it('invokes the cleanup service under a distributed lock', async () => {
        const stats = { outboxDeleted: 1, inboxDeleted: 0, idempotencyDeleted: 0, webhookDeliveriesDeleted: 0 };
        const service = { run: vi.fn().mockResolvedValue(stats), };
        const lock = {
            withLock: vi.fn(async (_resource, _ttl, work) => work()),
        };
        const logger = {
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        };
        const scheduler = new RetentionCleanupScheduler(service, lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, 300);
        const result = await scheduler.tick();
        expect(result).toEqual(stats);
        expect(lock.withLock).toHaveBeenCalledWith('retention-cleanup', 300, expect.any(Function));
        expect(service.run).toHaveBeenCalledOnce();
    });
    it('skips work when the distributed lock is not acquired', async () => {
        const service = { run: vi.fn(), };
        const lock = { withLock: vi.fn().mockResolvedValue(undefined), };
        const logger = {
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        };
        const scheduler = new RetentionCleanupScheduler(service, lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, 300);
        const result = await scheduler.tick();
        expect(result).toBeUndefined();
        expect(service.run).not.toHaveBeenCalled();
    });
    it('logs cleanup failures without rejecting tick()', async () => {
        const service = {
            run: vi.fn().mockRejectedValue(new RetentionCleanupError([{ resource: 'webhook_deliveries', reason: 'Database operation failed' }], {
                outboxDeleted: 0,
                inboxDeleted: 0,
                idempotencyDeleted: 0,
                webhookDeliveriesDeleted: 0,
            })),
        };
        const lock = { withLock: vi.fn(async (_resource, _ttl, work) => work()) };
        const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };
        const scheduler = new RetentionCleanupScheduler(service, lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, 300);
        await expect(scheduler.tick()).resolves.toBeUndefined();
        expect(logger.error).toHaveBeenCalled();
        const healthy = { run: vi.fn().mockResolvedValue({ outboxDeleted: 0, inboxDeleted: 0, idempotencyDeleted: 0, webhookDeliveriesDeleted: 0 }) };
        const recoveryScheduler = new RetentionCleanupScheduler(healthy, lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, 300);
        await expect(recoveryScheduler.tick()).resolves.toEqual(expect.objectContaining({ outboxDeleted: 0 }));
    });
    it('runScheduledTick swallows rejections from tick()', async () => {
        const service = { run: vi.fn().mockRejectedValue(new Error('boom')) };
        const lock = { withLock: vi.fn(async (_resource, _ttl, work) => work()) };
        const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };
        const scheduler = new RetentionCleanupScheduler(service, lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, 300);
        await expect(scheduler.runScheduledTick()).resolves.toBeUndefined();
    });
    it('does not overlap tick() executions while a run is in progress', async () => {
        let resolveRun;
        const runPromise = new Promise((resolve) => {
            resolveRun = resolve;
        });
        const service = {
            run: vi.fn(() => runPromise),
        };
        const lock = { withLock: vi.fn(async (_resource, _ttl, work) => work()) };
        const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };
        const scheduler = new RetentionCleanupScheduler(service, lock, {
            outboxDays: 30,
            inboxDays: 30,
            idempotencyDays: 7,
            webhookDeliveryDays: 30,
            batchSize: 100,
            intervalMs: 60_000,
        }, logger, 300);
        const first = scheduler.tick();
        const second = await scheduler.tick();
        expect(second).toBeUndefined();
        expect(service.run).toHaveBeenCalledTimes(1);
        resolveRun({ outboxDeleted: 0, inboxDeleted: 0, idempotencyDeleted: 0, webhookDeliveriesDeleted: 0 });
        await first;
    });
});
describe('WebhookDeliveryRetention', () => {
    it('skips tenant-scoped deletes when no eligible rows exist', async () => {
        const database = {
            executeAsOwner: vi.fn(async (work) => work({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
            execute: vi.fn(),
        };
        const retention = new WebhookDeliveryRetention(database);
        const deleted = await retention.purgeTerminalBefore(new Date('2020-01-01'), 100);
        expect(deleted).toBe(0);
        expect(database.execute).not.toHaveBeenCalled();
    });
});
