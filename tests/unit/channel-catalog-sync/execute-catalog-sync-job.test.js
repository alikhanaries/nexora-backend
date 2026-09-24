import { describe, expect, it, vi } from 'vitest';
import { ChannelStatus } from '../../../src/modules/channels/public/index.js';
import { CatalogSyncOperation } from '../../../src/modules/channel-catalog-sync/domain/sync-operation.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { ExecuteCatalogSyncJob } from '../../../src/modules/channel-catalog-sync/application/execute-catalog-sync-job.js';
import { MarketplaceCatalogAdapterRegistry } from '../../../src/modules/channel-catalog-sync/infrastructure/marketplace-catalog-adapter-registry.js';
import { FOUNDATION_STUB_MARKETPLACE_KEY } from '../../../src/modules/channel-catalog-sync/public/marketplace-catalog-adapter.port.js';
import { NotFoundError } from '../../../src/shared/errors/index.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '99999999-9999-4999-8999-999999999999';
const channelId = '22222222-2222-4222-8222-222222222222';
const entityId = '33333333-3333-4333-8333-333333333333';
const marketplaceId = '44444444-4444-4444-8444-444444444444';
const eventId = '55555555-5555-4555-8555-555555555555';

function validPayload(overrides = {}) {
    return {
        tenantId,
        channelId,
        target: CatalogSyncTarget.OFFER,
        entityId,
        operation: CatalogSyncOperation.SYNC,
        sourceEventId: eventId,
        correlationId: 'corr',
        ...overrides,
    };
}

function createExecutor(overrides = {}) {
    const registry = new MarketplaceCatalogAdapterRegistry();
    const adapterExecute = vi.fn().mockResolvedValue(undefined);
    registry.register({
        marketplaceKey: FOUNDATION_STUB_MARKETPLACE_KEY,
        execute: adapterExecute,
    });
    const channelQueryService = {
        getChannelById: vi.fn().mockResolvedValue({
            id: channelId,
            tenantId,
            marketplaceId,
            status: ChannelStatus.ACTIVE,
        }),
        ...(overrides.channelQueryService ?? {}),
    };
    const marketplaceLookup = {
        findById: vi.fn().mockResolvedValue({
            id: marketplaceId,
            key: FOUNDATION_STUB_MARKETPLACE_KEY,
            status: 'ACTIVE',
        }),
        ...(overrides.marketplaceLookup ?? {}),
    };
    const rateLimiter = {
        consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
        ...(overrides.rateLimiter ?? {}),
    };
    const database = {
        execute: vi.fn(async (work) => work({})),
    };
    const executor = new ExecuteCatalogSyncJob({
        database,
        channelQueryService,
        marketplaceLookup,
        adapterRegistry: registry,
        rateLimiter,
        metrics: { recordCatalogSync: vi.fn() },
        logger: { info: vi.fn(), warn: vi.fn() },
    });
    return { executor, adapterExecute, channelQueryService, rateLimiter, database };
}

describe('ExecuteCatalogSyncJob', () => {
    it('completes a valid job using the foundation stub adapter', async () => {
        const { executor, adapterExecute } = createExecutor();
        await executor.execute(validPayload());
        expect(adapterExecute).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed payloads without throwing', async () => {
        const { executor, adapterExecute } = createExecutor();
        await executor.execute({ tenantId: 'not-a-uuid' });
        expect(adapterExecute).not.toHaveBeenCalled();
    });

    it('skips inactive channels', async () => {
        const { executor, adapterExecute } = createExecutor({
            channelQueryService: {
                getChannelById: vi.fn().mockResolvedValue({
                    id: channelId,
                    tenantId,
                    marketplaceId,
                    status: ChannelStatus.INACTIVE,
                }),
            },
        });
        await executor.execute(validPayload());
        expect(adapterExecute).not.toHaveBeenCalled();
    });

    it('does not retry unsupported marketplace adapters', async () => {
        const { executor, adapterExecute } = createExecutor({
            marketplaceLookup: {
                findById: vi.fn().mockResolvedValue({
                    id: marketplaceId,
                    key: 'unknown-marketplace',
                    status: 'ACTIVE',
                }),
            },
        });
        await executor.execute(validPayload());
        expect(adapterExecute).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant channel access via tenant-scoped lookup failure', async () => {
        const { executor, adapterExecute } = createExecutor({
            channelQueryService: {
                getChannelById: vi.fn().mockRejectedValue(new NotFoundError('Channel was not found', {
                    tenantId: otherTenantId,
                    channelId,
                })),
            },
        });
        await executor.execute(validPayload({ tenantId: otherTenantId }));
        expect(adapterExecute).not.toHaveBeenCalled();
    });
});
