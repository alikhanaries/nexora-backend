import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryService } from '../../../src/modules/webhooks/application/webhook-delivery-service.js';
import { WebhookDeliveryRetryError } from '../../../src/modules/webhooks/application/webhook-delivery-errors.js';
import { verifyWebhookRequestBody } from '../../../src/modules/webhooks/application/webhook-request-signer.js';

function buildJob(overrides = {}) {
    return {
        tenantId: randomUUID(),
        deliveryId: randomUUID(),
        subscriptionId: randomUUID(),
        eventId: randomUUID(),
        eventType: 'order.created',
        ...overrides,
    };
}

function buildContext(overrides = {}) {
    return {
        id: 'job-1',
        name: 'deliver-webhook',
        queue: 'webhook-deliveries',
        attempt: 1,
        maxAttempts: 5,
        ...overrides,
    };
}

function createService(overrides = {}) {
    const deliveries = {
        findById: vi.fn(),
        claimAttempt: vi.fn(),
        update: vi.fn().mockResolvedValue(true),
    };
    const subscriptions = {
        findById: vi.fn(),
    };
    const outbox = {
        findByIdForTenant: vi.fn(),
    };
    const httpClient = {
        send: vi.fn(),
    };
    const secretEncryptor = {
        encrypt: vi.fn(),
        decrypt: vi.fn().mockReturnValue('plain-secret'),
    };
    const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(),
    };
    logger.child.mockReturnValue(logger);
    const deps = {
        database: {
            execute: vi.fn(async (work) => work({})),
        },
        deliveries,
        subscriptions,
        outbox,
        httpClient,
        secretEncryptor,
        logger,
        metrics: undefined,
        ssrfValidator: vi.fn(async (url) => new URL(url)),
        config: { timeoutMs: 5_000, leaseSeconds: 300 },
        ...overrides,
    };
    return {
        service: new WebhookDeliveryService(deps),
        deps,
    };
}

describe('WebhookDeliveryService', () => {
    it('delivers a signed webhook and marks the delivery as DELIVERED', async () => {
        const job = buildJob();
        const { service, deps } = createService();
        const delivery = {
            id: job.deliveryId,
            tenantId: job.tenantId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            eventType: job.eventType,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: new Date(),
        };
        deps.deliveries.findById.mockResolvedValue(delivery);
        deps.deliveries.claimAttempt.mockResolvedValue({ ...delivery, status: 'DELIVERING', attemptCount: 1 });
        deps.subscriptions.findById.mockResolvedValue({
            id: job.subscriptionId,
            tenantId: job.tenantId,
            url: 'https://hooks.example.com/nexora',
            secretCiphertext: 'cipher',
            status: 'ACTIVE',
            eventTypes: ['order.created'],
        });
        deps.outbox.findByIdForTenant.mockResolvedValue({
            id: job.eventId,
            type: job.eventType,
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId: job.tenantId,
            payload: { orderNumber: 'ORD-1' },
            occurredAt: new Date('2026-01-01T00:00:00.000Z'),
            correlationId: null,
        });
        deps.httpClient.send.mockResolvedValue({ status: 200, headers: {}, body: null, durationMs: 10, ok: true });
        await service.deliver(job, buildContext());
        expect(deps.httpClient.send).toHaveBeenCalledOnce();
        const request = deps.httpClient.send.mock.calls[0][0];
        expect(request.body).not.toContain('plain-secret');
        expect(request.headers['X-Nexora-Signature']).toMatch(/^v1=/);
        expect(verifyWebhookRequestBody('plain-secret', request.body, request.headers['X-Nexora-Signature'])).toBe(true);
        expect(deps.deliveries.update).toHaveBeenCalledWith({}, expect.objectContaining({
            status: 'DELIVERED',
            lastHttpStatus: 200,
            deliveredAt: expect.any(Date),
        }), { expectedStatuses: ['DELIVERING'] });
    });

    it('skips already delivered rows without making HTTP requests', async () => {
        const job = buildJob();
        const { service, deps } = createService();
        deps.deliveries.findById.mockResolvedValue({
            id: job.deliveryId,
            tenantId: job.tenantId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            eventType: job.eventType,
            status: 'DELIVERED',
            attemptCount: 1,
            nextAttemptAt: null,
            lastHttpStatus: 200,
            lastError: null,
            deliveredAt: new Date(),
            createdAt: new Date(),
        });
        await service.deliver(job, buildContext());
        expect(deps.httpClient.send).not.toHaveBeenCalled();
    });

    it('dead-letters inactive subscriptions without HTTP', async () => {
        const job = buildJob();
        const { service, deps } = createService();
        const delivery = {
            id: job.deliveryId,
            tenantId: job.tenantId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            eventType: job.eventType,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: new Date(),
        };
        deps.deliveries.findById.mockResolvedValue(delivery);
        deps.subscriptions.findById.mockResolvedValue({
            id: job.subscriptionId,
            status: 'DISABLED',
        });
        await service.deliver(job, buildContext());
        expect(deps.httpClient.send).not.toHaveBeenCalled();
        expect(deps.deliveries.update).toHaveBeenCalledWith({}, expect.objectContaining({
            status: 'DEAD_LETTERED',
            lastError: 'Webhook subscription is not active',
        }), { expectedStatuses: ['PENDING', 'FAILED'] });
    });

    it('throws a retry error for retryable HTTP failures before max attempts', async () => {
        const job = buildJob();
        const { service, deps } = createService();
        const delivery = {
            id: job.deliveryId,
            tenantId: job.tenantId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            eventType: job.eventType,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: new Date(),
        };
        deps.deliveries.findById.mockResolvedValue(delivery);
        deps.deliveries.claimAttempt.mockResolvedValue({ ...delivery, status: 'DELIVERING', attemptCount: 1 });
        deps.subscriptions.findById.mockResolvedValue({
            id: job.subscriptionId,
            tenantId: job.tenantId,
            url: 'https://hooks.example.com/nexora',
            secretCiphertext: 'cipher',
            status: 'ACTIVE',
        });
        deps.outbox.findByIdForTenant.mockResolvedValue({
            id: job.eventId,
            type: job.eventType,
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId: job.tenantId,
            payload: {},
            occurredAt: new Date(),
            correlationId: null,
        });
        deps.httpClient.send.mockResolvedValue({ status: 500, headers: {}, body: null, durationMs: 10, ok: false });
        await expect(service.deliver(job, buildContext({ attempt: 1, maxAttempts: 5 }))).rejects.toBeInstanceOf(WebhookDeliveryRetryError);
        expect(deps.deliveries.update).toHaveBeenCalledWith({}, expect.objectContaining({
            status: 'FAILED',
            lastHttpStatus: 500,
        }), { expectedStatuses: ['DELIVERING'] });
    });

    it('dead-letters permanent HTTP failures', async () => {
        const job = buildJob();
        const { service, deps } = createService();
        const delivery = {
            id: job.deliveryId,
            tenantId: job.tenantId,
            subscriptionId: job.subscriptionId,
            eventId: job.eventId,
            eventType: job.eventType,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: null,
            lastHttpStatus: null,
            lastError: null,
            deliveredAt: null,
            createdAt: new Date(),
        };
        deps.deliveries.findById.mockResolvedValue(delivery);
        deps.deliveries.claimAttempt.mockResolvedValue({ ...delivery, status: 'DELIVERING', attemptCount: 1 });
        deps.subscriptions.findById.mockResolvedValue({
            id: job.subscriptionId,
            tenantId: job.tenantId,
            url: 'https://hooks.example.com/nexora',
            secretCiphertext: 'cipher',
            status: 'ACTIVE',
        });
        deps.outbox.findByIdForTenant.mockResolvedValue({
            id: job.eventId,
            type: job.eventType,
            version: 1,
            aggregateType: 'order',
            aggregateId: randomUUID(),
            tenantId: job.tenantId,
            payload: {},
            occurredAt: new Date(),
            correlationId: null,
        });
        deps.httpClient.send.mockResolvedValue({ status: 400, headers: {}, body: null, durationMs: 10, ok: false });
        await service.deliver(job, buildContext());
        expect(deps.deliveries.update).toHaveBeenCalledWith({}, expect.objectContaining({
            status: 'DEAD_LETTERED',
            lastHttpStatus: 400,
        }), { expectedStatuses: ['DELIVERING'] });
    });
});
