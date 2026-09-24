import { describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryRetryError } from '../../../src/modules/webhooks/application/webhook-delivery-errors.js';
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
});
