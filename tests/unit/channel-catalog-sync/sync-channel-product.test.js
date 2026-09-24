import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncOperation } from '../../../src/modules/channel-catalog-sync/domain/sync-operation.js';
import { CatalogSyncTarget } from '../../../src/modules/channel-catalog-sync/domain/sync-target.js';
import { SyncChannelProduct } from '../../../src/modules/channel-catalog-sync/application/sync-channel-product.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const channelId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';

describe('SyncChannelProduct', () => {
    it('loads current product and calls syncProduct with offer external reference', async () => {
        const syncProduct = vi.fn().mockResolvedValue(undefined);
        const productQueryService = {
            getProductById: vi.fn().mockResolvedValue({
                id: productId,
                merchantSku: 'SKU-1',
                productType: 'STANDARD',
                status: 'ACTIVE',
                externalReference: 'PROD-EXT',
            }),
        };
        const offerQueryService = {
            getOfferForProductAndChannel: vi.fn().mockResolvedValue({
                id: '55555555-5555-4555-8555-555555555555',
                channelId,
                status: 'ACTIVE',
                listingStatus: 'LISTED',
                externalReference: 'MP-LISTING-1',
            }),
        };
        const service = new SyncChannelProduct({ productQueryService, offerQueryService });
        await service.execute({
            job: {
                tenantId,
                channelId,
                target: CatalogSyncTarget.PRODUCT,
                entityId: productId,
                operation: CatalogSyncOperation.SYNC,
                sourceEventId: '66666666-6666-4666-8666-666666666666',
                correlationId: null,
            },
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncProduct },
            tx: {},
        });
        expect(syncProduct).toHaveBeenCalledWith(expect.objectContaining({
            merchantSku: 'SKU-1',
            externalCatalogIdentifier: 'MP-LISTING-1',
            productExternalReference: 'PROD-EXT',
        }));
    });

    it('uses current product title state on repeated execution', async () => {
        const syncProduct = vi.fn().mockResolvedValue(undefined);
        const getProductById = vi.fn()
            .mockResolvedValueOnce({
                id: productId,
                merchantSku: 'SKU-OLD',
                productType: 'STANDARD',
                status: 'ACTIVE',
                externalReference: null,
            })
            .mockResolvedValueOnce({
                id: productId,
                merchantSku: 'SKU-NEW',
                productType: 'STANDARD',
                status: 'ACTIVE',
                externalReference: null,
            });
        const offerQueryService = {
            getOfferForProductAndChannel: vi.fn().mockResolvedValue({
                channelId,
                status: 'ACTIVE',
                listingStatus: 'LISTED',
                externalReference: 'MP-1',
            }),
        };
        const service = new SyncChannelProduct({
            productQueryService: { getProductById },
            offerQueryService,
        });
        const ctx = {
            channel: { id: channelId, tenantId },
            marketplace: { key: 'nexora-foundation-stub' },
            adapter: { syncProduct },
            tx: {},
        };
        const job = {
            tenantId,
            channelId,
            target: CatalogSyncTarget.PRODUCT,
            entityId: productId,
            operation: CatalogSyncOperation.SYNC,
            sourceEventId: '66666666-6666-4666-8666-666666666666',
            correlationId: null,
        };
        await service.execute({ job, ...ctx });
        await service.execute({ job, ...ctx });
        expect(syncProduct).toHaveBeenLastCalledWith(expect.objectContaining({ merchantSku: 'SKU-NEW' }));
    });
});
