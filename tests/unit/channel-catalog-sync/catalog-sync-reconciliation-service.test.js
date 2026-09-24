import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncReconciliationService } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-reconciliation-service.js';
import { ChannelStatus } from '../../../src/modules/channels/public/index.js';
import { buildCatalogSyncJobId } from '../../../src/modules/channel-catalog-sync/application/build-catalog-sync-job-id.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';

describe('CatalogSyncReconciliationService', () => {
    const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const channelId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const offerId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

    function createService(overrides = {}) {
        const enqueuePlannedJobs = vi.fn().mockResolvedValue({ enqueued: 4 });
        const database = {
            query: vi.fn().mockResolvedValue({
                rows: [{ id: tenantA }, { id: tenantB }],
            }),
            execute: vi.fn(async (fn) => fn()),
        };
        const channelQueryService = {
            listChannels: vi.fn(async (tenantId) => {
                if (tenantId === tenantA) {
                    return [{
                        id: channelId,
                        tenantId: tenantA,
                        defaultStockLocationId: '11111111-1111-4111-8111-111111111111',
                        configurationReference: null,
                    }];
                }
                return [];
            }),
        };
        const offerQueryService = {
            listOffersPage: vi.fn().mockResolvedValue({
                items: [{
                    id: offerId,
                    tenantId: tenantA,
                    channelId,
                    productId,
                    externalReference: 'ext-1',
                    createdAt: new Date('2024-01-01T00:00:00.000Z'),
                }],
                nextCursor: null,
            }),
        };
        const service = new CatalogSyncReconciliationService({
            database,
            channelQueryService,
            offerQueryService,
            enqueueService: { enqueuePlannedJobs },
            pricingService: { listPrices: vi.fn().mockResolvedValue({ items: [] }) },
            config: {
                enabled: true,
                offerBatchSize: 10,
                maxJobsPerTick: 100,
            },
            logger: { info: vi.fn(), error: vi.fn() },
            metrics: undefined,
            ...overrides,
        });
        return { service, enqueuePlannedJobs, database, channelQueryService, offerQueryService };
    }

    it('returns disabled when reconciliation is not enabled', async () => {
        const { service } = createService({
            config: { enabled: false, offerBatchSize: 10, maxJobsPerTick: 100 },
        });
        const result = await service.run();
        expect(result.outcome).toBe('disabled');
    });

    it('discovers active channels and enqueues planned jobs for eligible offers', async () => {
        const { service, enqueuePlannedJobs, channelQueryService } = createService();
        const result = await service.run();
        expect(result.outcome).toBe('success');
        expect(result.jobsPlanned).toBe(4);
        expect(channelQueryService.listChannels).toHaveBeenCalledWith(tenantA, { status: ChannelStatus.ACTIVE });
        expect(enqueuePlannedJobs).toHaveBeenCalled();
    });

    it('skips inactive channels by never listing their offers', async () => {
        const { service, offerQueryService, channelQueryService } = createService();
        channelQueryService.listChannels.mockResolvedValue([]);
        await service.run();
        expect(offerQueryService.listOffersPage).not.toHaveBeenCalled();
    });

    it('respects offer batch size', async () => {
        const { service, offerQueryService } = createService({
            config: { enabled: true, offerBatchSize: 1, maxJobsPerTick: 500 },
        });
        offerQueryService.listOffersPage.mockResolvedValue({
            items: [
                {
                    id: offerId,
                    tenantId: tenantA,
                    channelId,
                    productId,
                    externalReference: 'ext-1',
                    createdAt: new Date('2024-01-02T00:00:00.000Z'),
                },
                {
                    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                    tenantId: tenantA,
                    channelId,
                    productId,
                    externalReference: 'ext-2',
                    createdAt: new Date('2024-01-01T00:00:00.000Z'),
                },
            ],
            nextCursor: null,
        });
        await service.run();
        expect(offerQueryService.listOffersPage).toHaveBeenCalledWith(
            tenantA,
            expect.any(Object),
            1,
            null,
        );
    });

    it('runs tenant-scoped database work per tenant', async () => {
        const { service, database } = createService();
        await service.run();
        expect(database.execute).toHaveBeenCalledWith(expect.any(Function), { tenantId: tenantA });
    });

    it('uses deterministic job ids via enqueue service (coalescing with event path)', async () => {
        const enqueue = vi.fn().mockResolvedValue({ id: 'job-1' });
        const { CatalogSyncEnqueueService } = await import('../../../src/modules/channel-catalog-sync/application/catalog-sync-enqueue-service.js');
        const enqueueService = new CatalogSyncEnqueueService({
            queue: { enqueue },
            offerQueryService: {},
            channelQueryService: {},
        });
        const planned = [{
            tenantId: tenantA,
            channelId,
            target: CatalogSyncTarget.PRODUCT,
            entityId: productId,
            operation: 'sync',
            sourceEventId: '99999999-9999-4999-8999-999999999999',
            correlationId: 'catalog-sync-reconciliation',
        }];
        await enqueueService.enqueuePlannedJobs(planned);
        expect(enqueue).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ tenantId: tenantA, channelId }),
            {
                jobId: buildCatalogSyncJobId({
                    tenantId: tenantA,
                    channelId,
                    target: CatalogSyncTarget.PRODUCT,
                    entityId: productId,
                    operation: 'sync',
                }),
            },
        );
    });
});
