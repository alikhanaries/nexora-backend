import { FOUNDATION_STUB_MARKETPLACE_KEY } from '../public/marketplace-catalog-adapter.port.js';

/**
 * No-op adapter for pipeline verification and tests — no external HTTP.
 */
export class FoundationStubMarketplaceCatalogAdapter {
    marketplaceKey = FOUNDATION_STUB_MARKETPLACE_KEY;

    /**
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplaceCatalogSyncContext} _context
     */
    async execute(_context) {
        return;
    }

    /**
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplaceInventorySyncInput} _input
     */
    async syncInventory(_input) {
        return;
    }

    /**
     * @param {import('../public/marketplace-catalog-adapter.port.js').MarketplacePriceSyncInput} _input
     */
    async syncPrice(_input) {
        return;
    }
}
