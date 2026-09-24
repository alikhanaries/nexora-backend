import { mapMarketplaceErrorToAdapterError } from '../../application/map-marketplace-error-to-adapter-error.js';
import { MarketplaceUnsupportedError } from '../../domain/marketplace-errors.js';

/**
 * @typedef {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} MarketplaceAdapterRuntime
 */

export class BaseMarketplaceCatalogAdapter {
    marketplaceKey;

    /**
     * @param {string} marketplaceKey
     */
    constructor(marketplaceKey) {
        this.marketplaceKey = marketplaceKey;
    }

    /** @returns {import('../../domain/marketplace-capabilities.js').MarketplaceCatalogCapabilities} */
    getCapabilities() {
        throw new MarketplaceUnsupportedError('Capabilities are not defined for this adapter');
    }

    /**
     * @param {MarketplaceAdapterRuntime} runtime
     */
    async testConnection(_runtime) {
        throw new MarketplaceUnsupportedError('Connection test is not supported');
    }

    /**
     * @param {() => Promise<void>} operation
     */
    async run(operation) {
        try {
            await operation();
        }
        catch (error) {
            throw mapMarketplaceErrorToAdapterError(error);
        }
    }

    /**
     * @param {MarketplaceAdapterRuntime | undefined} runtime
     * @param {string} operationName
     */
    assertRuntime(runtime, operationName) {
        if (runtime === undefined) {
            throw new MarketplaceUnsupportedError(`Missing marketplace runtime for ${operationName}`);
        }
    }

    /**
     * @param {import('../../domain/marketplace-capabilities.js').MarketplaceCatalogCapabilities} capabilities
     * @param {keyof import('../../domain/marketplace-capabilities.js').MarketplaceCatalogCapabilities} flag
     * @param {string} operationName
     */
    assertCapability(capabilities, flag, operationName) {
        if (!capabilities[flag]) {
            throw new MarketplaceUnsupportedError(`${operationName} is not supported for ${this.marketplaceKey}`);
        }
    }
}
