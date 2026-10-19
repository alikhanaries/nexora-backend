import { describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryRetryError } from '../../../src/modules/webhooks/outbound/services/webhook-delivery-errors.js';
import { registerWorkerHandlers } from '../../../src/workers/handlers/queue-job-handlers.js';

describe('queue job handlers', () => {
    it('delays webhook delivery jobs when Retry-After scheduling is signaled', async () => {
        const moveToDelayed = vi.fn().mockResolvedValue(undefined);
        const webhookDeliveryService = {
            deliver: vi.fn().mockRejectedValue(new WebhookDeliveryRetryError('rate limited', { retryDelayMs: 30_000 })),
        };
        const handlers = new Map();
        const workerRuntime = {
            register: (queue, handler) => {
                handlers.set(queue, handler);
            },
        };
        registerWorkerHandlers({
            workerRuntime,
            integrationEventRouter: { route: vi.fn() },
            webhookDeliveryService,
            channelCatalogSyncService: { processSyncJob: vi.fn() },
            executeMarketplaceLifecycleJob: { execute: vi.fn() },
            marketplaceLifecycleQueueName: 'marketplace-order-lifecycle',
        });
        const handler = handlers.get('webhook-deliveries');
        expect(handler).toBeTypeOf('function');
        await handler({
            tenantId: '00000000-0000-4000-8000-000000000001',
            deliveryId: '00000000-0000-4000-8000-000000000002',
            subscriptionId: '00000000-0000-4000-8000-000000000003',
            eventId: '00000000-0000-4000-8000-000000000004',
            eventType: 'order.created',
        }, {
            name: 'deliver-webhook',
            moveToDelayed,
        });
        expect(moveToDelayed).toHaveBeenCalledWith(30_000);
    });

    it('fails fast when required handler dependencies are missing', () => {
        expect(() => registerWorkerHandlers({
            workerRuntime: { register: vi.fn() },
            integrationEventRouter: { route: vi.fn() },
            webhookDeliveryService: { deliver: vi.fn() },
            channelCatalogSyncService: { processSyncJob: vi.fn() },
            executeMarketplaceLifecycleJob: { execute: vi.fn() },
        })).toThrow('marketplaceLifecycleQueueName is required for worker handlers');
    });

    it('rethrows non-retryable webhook delivery failures for BullMQ retry policy', async () => {
        const handlers = new Map();
        const failure = new Error('delivery permanently failed');
        registerWorkerHandlers({
            workerRuntime: {
                register: (queue, handler) => {
                    handlers.set(queue, handler);
                },
            },
            integrationEventRouter: { route: vi.fn() },
            webhookDeliveryService: {
                deliver: vi.fn().mockRejectedValue(failure),
            },
            channelCatalogSyncService: { processSyncJob: vi.fn() },
            executeMarketplaceLifecycleJob: { execute: vi.fn() },
            marketplaceLifecycleQueueName: 'marketplace-order-lifecycle',
        });
        const handler = handlers.get('webhook-deliveries');
        await expect(handler({
            tenantId: '00000000-0000-4000-8000-000000000001',
            deliveryId: '00000000-0000-4000-8000-000000000002',
            subscriptionId: '00000000-0000-4000-8000-000000000003',
            eventId: '00000000-0000-4000-8000-000000000004',
            eventType: 'order.created',
        }, {
            name: 'deliver-webhook',
            moveToDelayed: vi.fn(),
        })).rejects.toBe(failure);
    });
});
