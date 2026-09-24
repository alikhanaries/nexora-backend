import { createEmptyMarketplaceCapabilities } from '../../../domain/marketplace-capabilities.js';
import { MarketplaceConfigurationError, MarketplaceUnsupportedError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';

export const NAMSHI_MARKETPLACE_KEY = 'namshi';

/**
 * Namshi partner API contracts are partner-gated. This adapter registers the provider
 * and returns standardized unsupported/configuration outcomes until verified APIs are wired.
 */
export class NamshiCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    constructor() {
        super(NAMSHI_MARKETPLACE_KEY);
    }

    getCapabilities() {
        return createEmptyMarketplaceCapabilities();
    }

    async testConnection(runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'testConnection');
            throw new MarketplaceConfigurationError(
                'Namshi connection test requires verified partner API documentation and credentials',
            );
        });
    }

    async syncInventory(_input, runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            throw new MarketplaceUnsupportedError('Namshi inventory sync is not available without verified partner APIs');
        });
    }
}
