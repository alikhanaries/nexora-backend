import { describe, expect, it } from 'vitest';
import { MarketplaceCatalogAdapterRegistry } from '../../../src/modules/channel-catalog-sync/public/marketplace-catalog-adapter-registry.js';
import { registerMarketplaceCatalogAdapters } from '../../../src/modules/marketplaces/infrastructure/adapters/register-marketplace-catalog-adapters.js';
import { SHOPIFY_MARKETPLACE_KEY } from '../../../src/modules/marketplaces/infrastructure/adapters/shopify/shopify-catalog-adapter.js';
import { AMAZON_MARKETPLACE_KEY } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-catalog-adapter.js';
import { NOON_MARKETPLACE_KEY } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-catalog-adapter.js';
import { NAMSHI_MARKETPLACE_KEY } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-catalog-adapter.js';
import { createEmptyMarketplaceCapabilities } from '../../../src/modules/marketplaces/domain/marketplace-capabilities.js';
import {
    MarketplaceCatalogAdapterPermanentError,
} from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

const CAPABILITY_KEYS = Object.keys(createEmptyMarketplaceCapabilities());

/**
 * @param {import('../../../src/modules/channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceCatalogAdapter} adapter
 * @param {string} marketplaceKey
 */
export function runMarketplaceAdapterContractTests(adapter, marketplaceKey) {
    describe(`adapter contract (${marketplaceKey})`, () => {
        it('exposes a stable marketplaceKey', () => {
            expect(adapter.marketplaceKey).toBe(marketplaceKey);
        });
        it('declares capabilities via getCapabilities when implemented', () => {
            if (typeof adapter.getCapabilities !== 'function') {
                return;
            }
            const caps = adapter.getCapabilities();
            for (const key of CAPABILITY_KEYS) {
                expect(typeof caps[key]).toBe('boolean');
            }
        });
        it('exposes testConnection when supportsConnectionTest is true', () => {
            const caps = adapter.getCapabilities?.();
            if (caps?.supportsConnectionTest !== true) {
                return;
            }
            expect(typeof adapter.testConnection).toBe('function');
        });
        it('maps unsupported product sync to permanent adapter error', async () => {
            if (typeof adapter.syncProduct !== 'function') {
                return;
            }
            const caps = adapter.getCapabilities?.();
            if (caps?.supportsProductSync) {
                return;
            }
            await expect(adapter.syncProduct({
                tenantId: '00000000-0000-4000-8000-000000000001',
                channelId: '00000000-0000-4000-8000-000000000002',
                marketplaceKey,
                productId: '00000000-0000-4000-8000-000000000003',
                merchantSku: 'SKU',
                productType: 'SIMPLE',
                productStatus: 'ACTIVE',
                productExternalReference: null,
                externalCatalogIdentifier: 'SKU',
                offerStatus: 'ACTIVE',
                listingStatus: 'ACTIVE',
                operation: 'sync',
                sourceEventId: 'evt',
                correlationId: null,
            })).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
        });
        it('maps unsupported inventory sync to permanent adapter error without runtime', async () => {
            if (typeof adapter.syncInventory !== 'function') {
                return;
            }
            const caps = adapter.getCapabilities?.();
            if (caps?.supportsInventorySync) {
                return;
            }
            await expect(adapter.syncInventory({
                tenantId: '00000000-0000-4000-8000-000000000001',
                channelId: '00000000-0000-4000-8000-000000000002',
                marketplaceKey,
                productId: '00000000-0000-4000-8000-000000000003',
                externalCatalogIdentifier: 'sku-1',
                stockLocationId: '00000000-0000-4000-8000-000000000004',
                availableQuantity: 1,
                sourceEventId: 'evt',
                correlationId: null,
            })).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
        });
    });
}

describe('marketplace adapter registry', () => {
    it('registers production marketplace adapters', () => {
        const registry = new MarketplaceCatalogAdapterRegistry();
        registerMarketplaceCatalogAdapters(registry);
        expect(registry.resolve(SHOPIFY_MARKETPLACE_KEY).marketplaceKey).toBe(SHOPIFY_MARKETPLACE_KEY);
        expect(registry.resolve(AMAZON_MARKETPLACE_KEY).marketplaceKey).toBe(AMAZON_MARKETPLACE_KEY);
        expect(registry.resolve(NOON_MARKETPLACE_KEY).marketplaceKey).toBe(NOON_MARKETPLACE_KEY);
        expect(registry.resolve(NAMSHI_MARKETPLACE_KEY).marketplaceKey).toBe(NAMSHI_MARKETPLACE_KEY);
    });
});

const contractRegistry = new MarketplaceCatalogAdapterRegistry();
registerMarketplaceCatalogAdapters(contractRegistry);
runMarketplaceAdapterContractTests(contractRegistry.resolve(SHOPIFY_MARKETPLACE_KEY), SHOPIFY_MARKETPLACE_KEY);
runMarketplaceAdapterContractTests(contractRegistry.resolve(AMAZON_MARKETPLACE_KEY), AMAZON_MARKETPLACE_KEY);
runMarketplaceAdapterContractTests(contractRegistry.resolve(NOON_MARKETPLACE_KEY), NOON_MARKETPLACE_KEY);
runMarketplaceAdapterContractTests(contractRegistry.resolve(NAMSHI_MARKETPLACE_KEY), NAMSHI_MARKETPLACE_KEY);
