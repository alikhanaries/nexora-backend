import { describe, expect, it, vi } from 'vitest';
import { ShopifyCatalogAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-catalog-adapter.js';
import { MarketplaceHttpClient } from '../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

const runtime = {
    marketplaceKey: 'shopify',
    connectionRequired: true,
    credentials: {
        shopDomain: 'example.myshopify.com',
        accessToken: 'shpat_test',
    },
    configuration: {
        shopifyLocationId: 'gid://shopify/Location/1',
    },
};

describe('ShopifyCatalogAdapter', () => {
    it('testConnection calls Admin GraphQL shop query', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            data: { shop: { name: 'Example' } },
        }), { status: 200 }));
        const adapter = new ShopifyCatalogAdapter({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        await adapter.testConnection(runtime);
        expect(fetchImpl).toHaveBeenCalledOnce();
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toContain('example.myshopify.com/admin/api/');
        expect(init.headers['X-Shopify-Access-Token']).toBe('shpat_test');
    });

    it('maps 429 to retry adapter error', async () => {
        const fetchImpl = vi.fn(async () => new Response('rate limited', {
            status: 429,
            headers: { 'retry-after': '12' },
        }));
        const adapter = new ShopifyCatalogAdapter({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });

    it('maps 401 to permanent adapter error', async () => {
        const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
        const adapter = new ShopifyCatalogAdapter({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('syncInventory sends inventorySetQuantities mutation', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: {
                    productVariant: { inventoryItem: { id: 'gid://shopify/InventoryItem/9' } },
                },
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { inventorySetQuantities: { userErrors: [] } },
            }), { status: 200 }));
        const adapter = new ShopifyCatalogAdapter({
            http: new MarketplaceHttpClient({ fetchImpl }),
        });
        await adapter.syncInventory({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: '1001',
            stockLocationId: '00000000-0000-4000-8000-000000000004',
            availableQuantity: 7,
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
});
