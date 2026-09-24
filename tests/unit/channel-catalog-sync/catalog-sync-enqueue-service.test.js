import { describe, expect, it, vi } from 'vitest';
import { JobName, QueueName } from '../../../src/infrastructure/queue/queue-names.js';
import { CatalogSyncEnqueueService } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-enqueue-service.js';
import { buildCatalogSyncJobId } from '../../../src/modules/channel-catalog-sync/application/build-catalog-sync-job-id.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';

describe('CatalogSyncEnqueueService', () => {
    it('enqueues coalesced jobs with deterministic job ids', async () => {
        const tenantId = '11111111-1111-4111-8111-111111111111';
        const channelId = '22222222-2222-4222-8222-222222222222';
        const productId = '33333333-3333-4333-8333-333333333333';
        const eventId = '44444444-4444-4444-8444-444444444444';
        const enqueue = vi.fn().mockResolvedValue({ id: 'job-1' });
        const service = new CatalogSyncEnqueueService({
            queue: { enqueue },
            offerQueryService: {
                getOffersByProduct: vi.fn().mockResolvedValue([{ channelId }]),
            },
            channelQueryService: { listChannels: vi.fn() },
        });
        const event = {
            id: eventId,
            type: 'product.created',
            version: 1,
            aggregateType: 'product',
            aggregateId: productId,
            tenantId,
            payload: { productId },
            occurredAt: new Date(),
            correlationId: null,
        };
        const result = await service.enqueueFromIntegrationEvent(event);
        expect(result.enqueued).toBe(1);
        expect(enqueue).toHaveBeenCalledWith(
            QueueName.CHANNEL_CATALOG_SYNC,
            JobName.RUN_CATALOG_SYNC,
            expect.objectContaining({
                tenantId,
                channelId,
                target: CatalogSyncTarget.PRODUCT,
            }),
            {
                jobId: buildCatalogSyncJobId({
                    tenantId,
                    channelId,
                    target: CatalogSyncTarget.PRODUCT,
                    entityId: productId,
                }),
            },
        );
    });
});
