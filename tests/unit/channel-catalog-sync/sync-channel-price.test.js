import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncOperation } from '../../../src/modules/channel-catalog-sync/domain/sync-operation.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { SyncChannelPrice } from '../../../src/modules/channel-catalog-sync/application/sync-channel-price.js';
import { CatalogSyncRetryError } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-errors.js';
import { MarketplaceCatalogAdapterRetryError } from '../../../src/modules/channel-catalog-sync/application/catalog-sync-adapter-errors.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const channelId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const eventId = '66666666-6666-4666-8666-666666666666';

function createService(overrides = {}) {
    const pricingService = {
        getEffectivePrice: vi.fn().mockResolvedValue({
            id: '77777777-7777-4777-8777-777777777777',
            currency: 'USD',
            amountMinor: 1999,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validTo: null,
        }),
        ...(overrides.pricingService ?? {}),
    };
    const offerQueryService = {
        getOfferForProductAndChannel: vi.fn().mockResolvedValue({
            id: '55555555-5555-4555-8555-555555555555',
            productId,
            channelId,
            status: 'ACTIVE',
            externalReference: 'MP-SKU-001',
        }),
        ...(overrides.offerQueryService ?? {}),
    };
    const syncPrice = vi.fn().mockResolvedValue(undefined);
    const service = new SyncChannelPrice({ pricingService, offerQueryService });
    return { service, pricingService, syncPrice };
}

function priceJob(overrides = {}) {
    return {
        tenantId,
        channelId,
        target: CatalogSyncTarget.PRICE,
        entityId: productId,
        currency: 'USD',
        operation: CatalogSyncOperation.SYNC,
        sourceEventId: eventId,
        correlationId: 'corr',
        ...overrides,
    };
}

describe('SyncChannelPrice', () => {
    it('syncs effective price from PricingService at execution time', async () => {
        const { service, syncPrice } = createService();
        await service.execute({
            job: priceJob(),
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncPrice },
            tx: {},
        });
        expect(syncPrice).toHaveBeenCalledWith(expect.objectContaining({
            externalCatalogIdentifier: 'MP-SKU-001',
            currency: 'USD',
            amountMinor: 1999,
        }));
    });

    it('skips when no effective price exists', async () => {
        const { service, syncPrice } = createService({
            pricingService: {
                getEffectivePrice: vi.fn().mockResolvedValue(null),
            },
        });
        await expect(service.execute({
            job: priceJob(),
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncPrice },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncSkippedError' });
    });

    it('fails permanently when external reference is missing', async () => {
        const { service, syncPrice } = createService({
            offerQueryService: {
                getOfferForProductAndChannel: vi.fn().mockResolvedValue({
                    id: '55555555-5555-4555-8555-555555555555',
                    status: 'ACTIVE',
                    externalReference: null,
                }),
            },
        });
        await expect(service.execute({
            job: priceJob(),
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncPrice },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncPermanentError' });
    });

    it('maps adapter retry errors', async () => {
        const syncPrice = vi.fn().mockRejectedValue(new MarketplaceCatalogAdapterRetryError('busy', {
            retryDelayMs: 1_000,
        }));
        const { service } = createService();
        await expect(service.execute({
            job: priceJob(),
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncPrice },
            tx: {},
        })).rejects.toBeInstanceOf(CatalogSyncRetryError);
    });

    it('uses latest effective price on repeated execution', async () => {
        const getEffectivePrice = vi.fn()
            .mockResolvedValueOnce({ id: 'a', currency: 'USD', amountMinor: 1000, validFrom: new Date(), validTo: null })
            .mockResolvedValueOnce({ id: 'b', currency: 'USD', amountMinor: 1500, validFrom: new Date(), validTo: null });
        const syncPrice = vi.fn().mockResolvedValue(undefined);
        const { service } = createService({ pricingService: { getEffectivePrice } });
        const ctx = {
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncPrice },
            tx: {},
        };
        await service.execute({ job: priceJob(), ...ctx });
        await service.execute({ job: priceJob({ sourceEventId: 'later' }), ...ctx });
        expect(syncPrice).toHaveBeenLastCalledWith(expect.objectContaining({ amountMinor: 1500 }));
    });
});
