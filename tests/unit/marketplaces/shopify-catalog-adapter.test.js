import { describe, expect, it, vi } from 'vitest';
import { ShopifyCatalogAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-catalog-adapter.js';
import { normalizeShopDomain } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-config.js';
import { ShopifyGraphqlClient } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-graphql-client.js';
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

function jsonResponse(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), { status, headers });
}

describe('shopify config', () => {
    it('normalizes bare shop handle to myshopify.com domain', () => {
        expect(normalizeShopDomain('Example')).toBe('example.myshopify.com');
    });
});

describe('ShopifyCatalogAdapter', () => {
    it('declares full catalog capabilities', () => {
        const adapter = new ShopifyCatalogAdapter();
        const caps = adapter.getCapabilities();
        expect(caps.supportsConnectionTest).toBe(true);
        expect(caps.supportsProductSync).toBe(true);
        expect(caps.supportsOfferSync).toBe(true);
        expect(caps.supportsInventorySync).toBe(true);
        expect(caps.supportsPriceSync).toBe(true);
        expect(caps.supportsActivation).toBe(true);
        expect(caps.supportsDeactivation).toBe(true);
    });

    it('testConnection calls Admin GraphQL shop query', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            data: { shop: { name: 'Example' } },
        }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
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
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });

    it('maps 401 to permanent adapter error', async () => {
        const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('maps GraphQL THROTTLED to retry adapter error', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
        }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });

    it('syncInventory sends inventorySetQuantities and returns inventory mapping hint', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                data: {
                    productVariant: { inventoryItem: { id: 'gid://shopify/InventoryItem/9' } },
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { inventorySetQuantities: { userErrors: [] } },
            }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const result = await adapter.syncInventory({
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
        expect(result).toEqual([{
            nexoraEntityType: 'product',
            nexoraEntityId: '00000000-0000-4000-8000-000000000003',
            externalEntityType: 'shopify_inventory_item',
            externalEntityId: 'gid://shopify/InventoryItem/9',
        }]);
    });

    it('syncInventory supports quantity zero', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                data: { productVariant: { inventoryItem: { id: 'gid://shopify/InventoryItem/9' } } },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { inventorySetQuantities: { userErrors: [] } },
            }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await adapter.syncInventory({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: '1001',
            stockLocationId: '00000000-0000-4000-8000-000000000004',
            availableQuantity: 0,
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
        expect(secondBody.variables.input.quantities[0].quantity).toBe(0);
    });

    it('syncPrice updates variant price from effective minor units', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({
            data: { productVariantUpdate: { productVariant: { id: 'gid://shopify/ProductVariant/1001' }, userErrors: [] } },
        }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await adapter.syncPrice({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: '1001',
            currency: 'USD',
            amountMinor: 1299,
            validFrom: '2026-01-01T00:00:00.000Z',
            validTo: null,
            priceId: '00000000-0000-4000-8000-000000000005',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.variables.input.price).toBe('12.99');
    });

    it('syncProduct deactivates by setting parent product status to DRAFT', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                data: {
                    productVariant: {
                        id: 'gid://shopify/ProductVariant/1001',
                        product: { id: 'gid://shopify/Product/2001', status: 'ACTIVE' },
                    },
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { productUpdate: { product: { id: 'gid://shopify/Product/2001', status: 'DRAFT' }, userErrors: [] } },
            }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await adapter.syncProduct({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'SKU-1',
            productType: 'simple',
            productStatus: 'ACTIVE',
            productExternalReference: null,
            externalCatalogIdentifier: '1001',
            offerStatus: 'INACTIVE',
            listingStatus: 'INACTIVE',
            operation: 'sync',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        const updateBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
        expect(updateBody.variables.input.status).toBe('DRAFT');
    });

    it('syncProduct returns product mapping hint on successful sync', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                data: {
                    productVariant: {
                        id: 'gid://shopify/ProductVariant/1001',
                        product: { id: 'gid://shopify/Product/2001', status: 'DRAFT' },
                    },
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { productVariantUpdate: { productVariant: { id: 'gid://shopify/ProductVariant/1001', sku: 'SKU-1' }, userErrors: [] } },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { productUpdate: { product: { id: 'gid://shopify/Product/2001', status: 'ACTIVE' }, userErrors: [] } },
            }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const hints = await adapter.syncProduct({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'SKU-1',
            productType: 'simple',
            productStatus: 'ACTIVE',
            productExternalReference: null,
            externalCatalogIdentifier: '1001',
            offerStatus: 'ACTIVE',
            listingStatus: 'ACTIVE',
            operation: 'sync',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(hints).toEqual([{
            nexoraEntityType: 'product',
            nexoraEntityId: '00000000-0000-4000-8000-000000000003',
            externalEntityType: 'shopify_product',
            externalEntityId: 'gid://shopify/Product/2001',
        }]);
    });

    it('syncOffer activate returns offer and product mapping hints', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({
                data: {
                    productVariant: {
                        id: 'gid://shopify/ProductVariant/1001',
                        product: { id: 'gid://shopify/Product/2001', status: 'DRAFT' },
                    },
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { productVariantUpdate: { productVariant: { id: 'gid://shopify/ProductVariant/1001', sku: 'SKU-1' }, userErrors: [] } },
            }))
            .mockResolvedValueOnce(jsonResponse({
                data: { productUpdate: { product: { id: 'gid://shopify/Product/2001', status: 'ACTIVE' }, userErrors: [] } },
            }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        const hints = await adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: '1001',
            offerStatus: 'ACTIVE',
            listingStatus: 'ACTIVE',
            operation: 'activate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(hints).toEqual([
            {
                nexoraEntityType: 'offer',
                nexoraEntityId: '00000000-0000-4000-8000-000000000010',
                externalEntityType: 'shopify_product_variant',
                externalEntityId: 'gid://shopify/ProductVariant/1001',
            },
            {
                nexoraEntityType: 'product',
                nexoraEntityId: '00000000-0000-4000-8000-000000000003',
                externalEntityType: 'shopify_product',
                externalEntityId: 'gid://shopify/Product/2001',
            },
        ]);
    });

    it('maps 500 to retry adapter error on syncOffer', async () => {
        const fetchImpl = vi.fn(async () => new Response('error', { status: 500 }));
        const adapter = new ShopifyCatalogAdapter({
            graphql: new ShopifyGraphqlClient({ http: new MarketplaceHttpClient({ fetchImpl }) }),
        });
        await expect(adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: '1001',
            offerStatus: 'ACTIVE',
            listingStatus: 'ACTIVE',
            operation: 'activate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });
});
