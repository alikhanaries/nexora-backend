import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ProcessMarketplaceLifecyclePayload } from '../../../src/modules/marketplace-order-ingestion/application/process-marketplace-lifecycle-payload.js';

describe('ProcessMarketplaceLifecyclePayload', () => {
    it('ensures ingest before applying lifecycle', async () => {
        const command = {
            operation: 'status_sync',
            externalOrderId: 'ext-1',
            externalEventId: 'evt-1',
            targetStatus: 'confirmed',
        };
        const adapter = {
            normalizeLifecycleCommand: vi.fn(async () => command),
        };
        const ensureMarketplaceOrderIngestedFromLifecycle = {
            execute: vi.fn(async () => ({ ingested: true, orderId: randomUUID() })),
        };
        const lifecycleService = {
            apply: vi.fn(async () => ({ outcome: 'applied' })),
        };
        const processor = new ProcessMarketplaceLifecyclePayload({
            lifecycleService,
            orderAdapterRegistry: { resolve: vi.fn(() => adapter) },
            channelQueryService: { getChannelById: vi.fn() },
            database: { execute: vi.fn(async (work) => work({})) },
            ensureMarketplaceOrderIngestedFromLifecycle,
        });
        const tenantId = randomUUID();
        const channelId = randomUUID();
        await processor.execute({
            tenantId,
            channelId,
            marketplaceKey: 'amazon',
            payload: { notification: {} },
            jobId: 'job-1',
        });
        expect(ensureMarketplaceOrderIngestedFromLifecycle.execute).toHaveBeenCalledOnce();
        expect(lifecycleService.apply).toHaveBeenCalledOnce();
        expect(ensureMarketplaceOrderIngestedFromLifecycle.execute.mock.invocationCallOrder[0])
            .toBeLessThan(lifecycleService.apply.mock.invocationCallOrder[0]);
        expect(lifecycleService.apply).toHaveBeenCalledWith({
            tenantId,
            channelId,
            command,
            jobId: 'job-1',
        });
    });
});
