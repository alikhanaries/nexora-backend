import { describe, expect, it, vi } from 'vitest';
import { MarketplaceAdapterRuntimeFactory } from '../../../src/modules/marketplaces/application/marketplace-adapter-runtime-factory.js';
import { FOUNDATION_STUB_MARKETPLACE_KEY } from '../../../src/modules/channel-catalog-sync/public/marketplace-catalog-adapter.port.js';
import { CatalogSyncPermanentError } from '../../../src/modules/channel-catalog-sync/public/catalog-sync-errors.js';

describe('MarketplaceAdapterRuntimeFactory', () => {
    it('returns empty runtime for foundation stub marketplace', async () => {
        const factory = new MarketplaceAdapterRuntimeFactory({
            connections: { findActiveByChannel: vi.fn() },
            secretEncryptor: { decrypt: vi.fn() },
            queryable: {},
        });
        const runtime = await factory.createForSync({
            tenantId: 't',
            channelId: 'c',
            marketplaceKey: FOUNDATION_STUB_MARKETPLACE_KEY,
        });
        expect(runtime.connectionRequired).toBe(false);
        expect(runtime.credentials).toEqual({});
    });

    it('throws permanent error when active connection is missing', async () => {
        const factory = new MarketplaceAdapterRuntimeFactory({
            connections: {
                findActiveByChannel: vi.fn(async () => null),
            },
            secretEncryptor: { decrypt: vi.fn() },
            queryable: {},
        });
        await expect(factory.createForSync({
            tenantId: 't',
            channelId: 'c',
            marketplaceKey: 'shopify',
        })).rejects.toBeInstanceOf(CatalogSyncPermanentError);
    });

    it('decrypts credentials for sync runtime', async () => {
        const factory = new MarketplaceAdapterRuntimeFactory({
            connections: {
                findActiveByChannel: vi.fn(async () => ({
                    marketplace_key: 'shopify',
                    credentials_ciphertext: 'cipher',
                    configuration: { shopifyLocationId: '1' },
                })),
            },
            secretEncryptor: {
                decrypt: vi.fn(() => JSON.stringify({ accessToken: 'tok', shopDomain: 'shop.myshopify.com' })),
            },
            queryable: {},
        });
        const runtime = await factory.createForSync({
            tenantId: 't',
            channelId: 'c',
            marketplaceKey: 'shopify',
        });
        expect(runtime.credentials.accessToken).toBe('tok');
        expect(runtime.configuration.shopifyLocationId).toBe('1');
    });
});
