import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncOperation } from '../../../src/modules/channel-catalog-sync/domain/sync-operation.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { SyncChannelInventory } from '../../../src/modules/channel-catalog-sync/application/sync-channel-inventory.js';
import { CatalogSyncRetryError } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-errors.js';
import { MarketplaceCatalogAdapterRetryError } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-adapter-errors.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '99999999-9999-4999-8999-999999999999';
const channelId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const stockLocationId = '44444444-4444-4444-8444-444444444444';
const offerId = '55555555-5555-4555-8555-555555555555';
const eventId = '66666666-6666-4666-8666-666666666666';

function createService(overrides = {}) {
    const inventoryService = {
        getAvailability: vi.fn().mockResolvedValue({
            locations: [{
                stockLocationId,
                onHand: 100,
                reserved: 20,
                available: 80,
            }],
        }),
        ...(overrides.inventoryService ?? {}),
    };
    const offerQueryService = {
        getOfferForProductAndChannel: vi.fn().mockResolvedValue({
            id: offerId,
            productId,
            channelId,
            status: 'ACTIVE',
            externalReference: 'MP-SKU-001',
        }),
        listActiveOffersByChannel: vi.fn().mockResolvedValue([]),
        ...(overrides.offerQueryService ?? {}),
    };
    const syncInventory = vi.fn().mockResolvedValue(undefined);
    const adapter = { marketplaceKey: 'nexora-foundation-stub', syncInventory };
    const service = new SyncChannelInventory({
        inventoryService,
        offerQueryService,
    });
    return {
        service,
        inventoryService,
        offerQueryService,
        adapter,
        syncInventory,
    };
}

function inventoryJob(overrides = {}) {
    return {
        tenantId,
        channelId,
        target: CatalogSyncTarget.INVENTORY,
        entityId: productId,
        operation: CatalogSyncOperation.SYNC,
        sourceEventId: eventId,
        correlationId: 'corr',
        stockLocationId,
        ...overrides,
    };
}

describe('SyncChannelInventory', () => {
    it('syncs absolute available quantity from InventoryService', async () => {
        const { service, adapter, syncInventory } = createService();
        await service.execute({
            job: inventoryJob(),
            channel: {
                id: channelId,
                tenantId,
                defaultStockLocationId: stockLocationId,
            },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter,
            tx: {},
        });
        expect(syncInventory).toHaveBeenCalledWith(expect.objectContaining({
            externalCatalogIdentifier: 'MP-SKU-001',
            availableQuantity: 80,
            stockLocationId,
        }), undefined);
    });

    it('uses legacy configurationReference when default stock location is unset', async () => {
        const syncInventory = vi.fn().mockResolvedValue(undefined);
        const { service } = createService();
        await service.execute({
            job: inventoryJob(),
            channel: {
                id: channelId,
                tenantId,
                defaultStockLocationId: null,
                configurationReference: stockLocationId,
            },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncInventory },
            tx: {},
        });
        expect(syncInventory).toHaveBeenCalledWith(expect.objectContaining({ stockLocationId }), undefined);
    });

    it('skips when stock location is not configured', async () => {
        const { service, syncInventory } = createService();
        await expect(service.execute({
            job: inventoryJob(),
            channel: {
                id: channelId,
                tenantId,
                defaultStockLocationId: null,
                configurationReference: null,
            },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncInventory },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncSkippedError' });
        expect(syncInventory).not.toHaveBeenCalled();
    });

    it('skips stale jobs when event stock location no longer matches channel', async () => {
        const { service, syncInventory } = createService();
        await expect(service.execute({
            job: inventoryJob({ stockLocationId: '77777777-7777-4777-8777-777777777777' }),
            channel: {
                id: channelId,
                tenantId,
                defaultStockLocationId: stockLocationId,
            },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncInventory },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncSkippedError' });
        expect(syncInventory).not.toHaveBeenCalled();
    });

    it('fails permanently when offer external reference is missing', async () => {
        const { service, syncInventory } = createService({
            offerQueryService: {
                getOfferForProductAndChannel: vi.fn().mockResolvedValue({
                    id: offerId,
                    productId,
                    channelId,
                    status: 'ACTIVE',
                    externalReference: null,
                }),
            },
        });
        await expect(service.execute({
            job: inventoryJob(),
            channel: { id: channelId, tenantId, defaultStockLocationId: stockLocationId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncInventory },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncPermanentError' });
    });

    it('rejects tenant mismatch on channel', async () => {
        const { service, syncInventory } = createService();
        await expect(service.execute({
            job: inventoryJob({ tenantId: otherTenantId }),
            channel: { id: channelId, tenantId, defaultStockLocationId: stockLocationId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncInventory },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncPermanentError' });
    });

    it('maps adapter retry errors to CatalogSyncRetryError', async () => {
        const syncInventory = vi.fn().mockRejectedValue(new MarketplaceCatalogAdapterRetryError('rate limited', {
            retryDelayMs: 5_000,
        }));
        const { service } = createService();
        await expect(service.execute({
            job: inventoryJob(),
            channel: { id: channelId, tenantId, defaultStockLocationId: stockLocationId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncInventory },
            tx: {},
        })).rejects.toBeInstanceOf(CatalogSyncRetryError);
    });

    it('reads current inventory at execution time (stale event protection)', async () => {
        const getAvailability = vi.fn()
            .mockResolvedValueOnce({
                locations: [{ stockLocationId, onHand: 10, reserved: 0, available: 10 }],
            })
            .mockResolvedValueOnce({
                locations: [{ stockLocationId, onHand: 15, reserved: 0, available: 15 }],
            });
        const syncInventory = vi.fn().mockResolvedValue(undefined);
        const { service } = createService({ inventoryService: { getAvailability } });
        const channel = { id: channelId, tenantId, defaultStockLocationId: stockLocationId };
        const adapter = { syncInventory };
        await service.execute({
            job: inventoryJob(),
            channel,
            marketplace: { key: 'nexora-foundation-stub' },
            adapter,
            tx: {},
        });
        await service.execute({
            job: inventoryJob({ sourceEventId: 'later-event' }),
            channel,
            marketplace: { key: 'nexora-foundation-stub' },
            adapter,
            tx: {},
        });
        expect(syncInventory).toHaveBeenLastCalledWith(expect.objectContaining({ availableQuantity: 15 }), undefined);
    });
});
