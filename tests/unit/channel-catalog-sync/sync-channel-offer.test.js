import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncOperation } from '../../../src/modules/channel-catalog-sync/domain/sync-operation.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { SyncChannelOffer } from '../../../src/modules/channel-catalog-sync/application/sync-channel-offer.js';
import { NotFoundError } from '../../../src/shared/errors/index.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const channelId = '22222222-2222-4222-8222-222222222222';
const offerId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';

describe('SyncChannelOffer', () => {
    it('validates offer belongs to job channel', async () => {
        const syncOffer = vi.fn();
        const service = new SyncChannelOffer({
            offerQueryService: {
                getOfferById: vi.fn().mockResolvedValue({
                    id: offerId,
                    channelId: '99999999-9999-4999-8999-999999999999',
                    productId,
                    status: 'ACTIVE',
                    listingStatus: 'LISTED',
                    externalReference: 'MP-1',
                }),
            },
            productQueryService: { getProductById: vi.fn() },
        });
        await expect(service.execute({
            job: {
                tenantId,
                channelId,
                target: CatalogSyncTarget.OFFER,
                entityId: offerId,
                operation: CatalogSyncOperation.SYNC,
                sourceEventId: '66666666-6666-4666-8666-666666666666',
                correlationId: null,
            },
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncOffer },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncPermanentError' });
    });

    it('skips when offer was removed', async () => {
        const service = new SyncChannelOffer({
            offerQueryService: {
                getOfferById: vi.fn().mockRejectedValue(new NotFoundError('Offer was not found', {
                    tenantId,
                    offerId,
                })),
            },
            productQueryService: { getProductById: vi.fn() },
        });
        await expect(service.execute({
            job: {
                tenantId,
                channelId,
                target: CatalogSyncTarget.OFFER,
                entityId: offerId,
                operation: CatalogSyncOperation.SYNC,
                sourceEventId: '66666666-6666-4666-8666-666666666666',
                correlationId: null,
            },
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncOffer: vi.fn() },
            tx: {},
        })).rejects.toMatchObject({ name: 'CatalogSyncSkippedError' });
    });
});
