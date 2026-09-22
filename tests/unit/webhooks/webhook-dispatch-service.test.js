import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { WebhookDispatchService } from '../../../src/modules/webhooks/application/webhook-dispatch-service.js';
import { ConflictError, ServiceUnavailableError } from '../../../src/shared/errors/index.js';
import { JobName, QueueName } from '../../../src/infrastructure/queue/queue-names.js';

function buildEvent(overrides = {}) {
    return {
        id: randomUUID(),
        type: 'order.created',
        version: 1,
        aggregateType: 'order',
        aggregateId: randomUUID(),
        tenantId: randomUUID(),
        payload: { hello: 'world' },
        correlationId: null,
        occurredAt: new Date(),
        ...overrides,
    };
}

function buildSubscription(overrides = {}) {
    return {
        id: randomUUID(),
        tenantId: randomUUID(),
        url: 'https://example.com/hook',
        description: null,
        secretCiphertext: 'encrypted',
        eventTypes: ['order.created'],
        status: 'ACTIVE',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

function createService(overrides = {}) {
    const subscriptions = {
        listActiveForEventType: vi.fn().mockResolvedValue([]),
    };
    const deliveries = {
        findBySubscriptionAndEventId: vi.fn().mockResolvedValue(null),
        insert: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
        enqueue: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };
    const database = {
        execute: vi.fn(async (work) => work({})),
    };
    const deps = {
        database,
        subscriptions,
        deliveries,
        queue,
        ...overrides,
    };
    return {
        service: new WebhookDispatchService(deps),
        deps,
    };
}

describe('WebhookDispatchService', () => {
    it('ignores non-deliverable event types', async () => {
        const { service, deps } = createService();
        const result = await service.dispatch(buildEvent({ type: 'marketplace.created' }));
        expect(result).toEqual({ deliveriesEnsured: 0, jobsEnqueued: 0 });
        expect(deps.subscriptions.listActiveForEventType).not.toHaveBeenCalled();
        expect(deps.queue.enqueue).not.toHaveBeenCalled();
    });

    it('dispatches Phase 7.5 product events through the existing pipeline', async () => {
        const event = buildEvent({ type: 'product.created' });
        const subscription = buildSubscription({
            tenantId: event.tenantId,
            eventTypes: ['product.created'],
        });
        const { service, deps } = createService();
        deps.subscriptions.listActiveForEventType.mockResolvedValue([subscription]);
        const result = await service.dispatch(event);
        expect(result).toEqual({ deliveriesEnsured: 1, jobsEnqueued: 1 });
        expect(deps.subscriptions.listActiveForEventType).toHaveBeenCalledWith({}, event.tenantId, 'product.created');
    });

    it('ignores events without tenant scope', async () => {
        const { service, deps } = createService();
        const result = await service.dispatch(buildEvent({ tenantId: null }));
        expect(result).toEqual({ deliveriesEnsured: 0, jobsEnqueued: 0 });
        expect(deps.subscriptions.listActiveForEventType).not.toHaveBeenCalled();
    });

    it('creates a pending delivery and enqueues identifier-only job data', async () => {
        const event = buildEvent();
        const subscription = buildSubscription({ tenantId: event.tenantId });
        const { service, deps } = createService();
        deps.subscriptions.listActiveForEventType.mockResolvedValue([subscription]);
        deps.deliveries.insert.mockImplementation(async (_tx, delivery) => {
            expect(delivery.status).toBe('PENDING');
            expect(delivery.attemptCount).toBe(0);
        });
        const result = await service.dispatch(event);
        expect(result).toEqual({ deliveriesEnsured: 1, jobsEnqueued: 1 });
        expect(deps.queue.enqueue).toHaveBeenCalledWith(QueueName.WEBHOOK_DELIVERIES, JobName.DELIVER_WEBHOOK, {
            tenantId: event.tenantId,
            deliveryId: expect.any(String),
            subscriptionId: subscription.id,
            eventId: event.id,
            eventType: event.type,
        }, { jobId: `${subscription.id}_${event.id}` });
        const payload = deps.queue.enqueue.mock.calls[0][2];
        expect(payload).not.toHaveProperty('secret');
        expect(payload).not.toHaveProperty('secretCiphertext');
        expect(payload).not.toHaveProperty('payload');
    });

    it('reuses an existing delivery row on duplicate processing', async () => {
        const event = buildEvent();
        const subscription = buildSubscription({ tenantId: event.tenantId });
        const existingDelivery = {
            id: randomUUID(),
            tenantId: event.tenantId,
            subscriptionId: subscription.id,
            eventId: event.id,
            eventType: event.type,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: new Date(),
        };
        const { service, deps } = createService();
        deps.subscriptions.listActiveForEventType.mockResolvedValue([subscription]);
        deps.deliveries.findBySubscriptionAndEventId.mockResolvedValue(existingDelivery);
        const result = await service.dispatch(event);
        expect(result).toEqual({ deliveriesEnsured: 1, jobsEnqueued: 1 });
        expect(deps.deliveries.insert).not.toHaveBeenCalled();
    });

    it('treats unique constraint conflicts as idempotent delivery creation', async () => {
        const event = buildEvent();
        const subscription = buildSubscription({ tenantId: event.tenantId });
        const racedDelivery = {
            id: randomUUID(),
            tenantId: event.tenantId,
            subscriptionId: subscription.id,
            eventId: event.id,
            eventType: event.type,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: new Date(),
        };
        const { service, deps } = createService();
        deps.subscriptions.listActiveForEventType.mockResolvedValue([subscription]);
        deps.deliveries.insert.mockRejectedValue(new ConflictError('Resource already exists', {
            constraint: 'webhook_deliveries_subscription_event_unique',
        }));
        deps.deliveries.findBySubscriptionAndEventId
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(racedDelivery);
        const result = await service.dispatch(event);
        expect(result).toEqual({ deliveriesEnsured: 1, jobsEnqueued: 1 });
    });

    it('creates one delivery per matching subscription', async () => {
        const event = buildEvent();
        const first = buildSubscription({ tenantId: event.tenantId });
        const second = buildSubscription({ tenantId: event.tenantId });
        const { service, deps } = createService();
        deps.subscriptions.listActiveForEventType.mockResolvedValue([first, second]);
        const result = await service.dispatch(event);
        expect(result).toEqual({ deliveriesEnsured: 2, jobsEnqueued: 2 });
        expect(deps.deliveries.insert).toHaveBeenCalledTimes(2);
        expect(deps.queue.enqueue).toHaveBeenCalledTimes(2);
    });

    it('treats duplicate queue job ids as idempotent enqueue', async () => {
        const event = buildEvent();
        const subscription = buildSubscription({ tenantId: event.tenantId });
        const { service, deps } = createService();
        deps.subscriptions.listActiveForEventType.mockResolvedValue([subscription]);
        deps.queue.enqueue.mockRejectedValue(new ServiceUnavailableError('Could not enqueue job', {
            reason: 'Job already exists',
        }));
        const result = await service.dispatch(event);
        expect(result).toEqual({ deliveriesEnsured: 1, jobsEnqueued: 0 });
    });
});
