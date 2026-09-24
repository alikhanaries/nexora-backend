import { describe, expect, it, vi } from 'vitest';
import { AmazonCatalogAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-catalog-adapter.js';
import { AmazonSpApiClient } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-sp-api-client.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

const runtime = {
    marketplaceKey: 'amazon',
    connectionRequired: true,
    credentials: {
        clientId: 'amzn1.application-oa2-client.test',
        clientSecret: 'secret',
        refreshToken: 'Atzr|refresh',
        awsAccessKeyId: 'AKIAEXAMPLE',
        awsSecretAccessKey: 'aws-secret',
        sellerId: 'SELLER123',
    },
    configuration: {
        marketplaceId: 'ATVPDKIKX0DER',
        region: 'na',
        listingsProductType: 'PRODUCT',
    },
};

describe('AmazonCatalogAdapter', () => {
    it('declares production catalog capabilities', () => {
        const adapter = new AmazonCatalogAdapter();
        const caps = adapter.getCapabilities();
        expect(caps.supportsConnectionTest).toBe(true);
        expect(caps.supportsInventorySync).toBe(true);
        expect(caps.supportsPriceSync).toBe(true);
        expect(caps.supportsProductSync).toBe(true);
        expect(caps.supportsOfferSync).toBe(true);
    });

    it('testConnection calls marketplace participations', async () => {
        const getMarketplaceParticipations = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new AmazonCatalogAdapter({
            spApi: { getMarketplaceParticipations, patchListingItem: vi.fn() },
        });
        await adapter.testConnection(runtime);
        expect(getMarketplaceParticipations).toHaveBeenCalledOnce();
    });

    it('syncInventory patches fulfillment quantity and returns mapping hint', async () => {
        const patchListingItem = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new AmazonCatalogAdapter({
            spApi: { getMarketplaceParticipations: vi.fn(), patchListingItem },
        });
        const hints = await adapter.syncInventory({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'amazon',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: 'SKU-1',
            stockLocationId: '00000000-0000-4000-8000-000000000004',
            availableQuantity: 0,
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(patchListingItem).toHaveBeenCalledOnce();
        expect(JSON.stringify(patchListingItem.mock.calls[0][2])).toContain('"quantity":0');
        expect(hints?.[0]?.externalEntityId).toBe('SKU-1');
    });

    it('syncPrice patches purchasable_offer with effective minor units', async () => {
        const patchListingItem = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new AmazonCatalogAdapter({
            spApi: { getMarketplaceParticipations: vi.fn(), patchListingItem },
        });
        await adapter.syncPrice({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'amazon',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: 'SKU-1',
            currency: 'USD',
            amountMinor: 1999,
            validFrom: '2026-01-01T00:00:00.000Z',
            validTo: null,
            priceId: '00000000-0000-4000-8000-000000000005',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        const patches = patchListingItem.mock.calls[0][2];
        expect(JSON.stringify(patches)).toContain('"value_with_tax":19.99');
    });

    it('syncOffer deactivate sets quantity zero without deleting listing', async () => {
        const patchListingItem = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new AmazonCatalogAdapter({
            spApi: { getMarketplaceParticipations: vi.fn(), patchListingItem },
        });
        await adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'amazon',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: 'SKU-1',
            offerStatus: 'INACTIVE',
            listingStatus: 'INACTIVE',
            operation: 'deactivate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(patchListingItem).toHaveBeenCalledOnce();
    });

});

describe('AmazonCatalogAdapter HTTP errors', () => {
    it('maps 401 to permanent adapter error on connection test', async () => {
        const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
        const { MarketplaceHttpClient } = await import('../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js');
        const { AmazonLwaTokenProvider } = await import('../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-lwa-token-provider.js');
        const lwa = new AmazonLwaTokenProvider({
            http: new MarketplaceHttpClient({
                fetchImpl: vi.fn(async () => new Response(JSON.stringify({
                    access_token: 'Atza|access',
                    expires_in: 3600,
                }), { status: 200 })),
            }),
        });
        const spApi = new AmazonSpApiClient({
            lwa,
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        const adapter = new AmazonCatalogAdapter({ spApi });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('maps 500 to retry adapter error', async () => {
        const fetchImpl = vi.fn(async () => new Response('error', { status: 500 }));
        const { MarketplaceHttpClient } = await import('../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js');
        const { AmazonLwaTokenProvider } = await import('../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-lwa-token-provider.js');
        const lwa = new AmazonLwaTokenProvider({
            http: new MarketplaceHttpClient({
                fetchImpl: vi.fn(async () => new Response(JSON.stringify({
                    access_token: 'Atza|access',
                    expires_in: 3600,
                }), { status: 200 })),
            }),
        });
        const spApi = new AmazonSpApiClient({
            lwa,
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        const adapter = new AmazonCatalogAdapter({ spApi });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });
});
