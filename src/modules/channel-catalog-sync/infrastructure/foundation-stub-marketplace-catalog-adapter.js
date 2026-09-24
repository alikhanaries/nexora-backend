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
}
