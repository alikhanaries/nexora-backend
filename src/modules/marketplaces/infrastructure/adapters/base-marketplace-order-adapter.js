import { mapMarketplaceErrorToAdapterError } from '../../application/map-marketplace-error-to-adapter-error.js';
import { MarketplaceUnsupportedError } from '../../domain/marketplace-errors.js';

export class BaseMarketplaceOrderAdapter {
    marketplaceKey;

    /**
     * @param {string} marketplaceKey
     */
    constructor(marketplaceKey) {
        this.marketplaceKey = marketplaceKey;
    }

    /**
     * @template T
     * @param {() => Promise<T>} operation
     * @returns {Promise<T>}
     */
    async runWithResult(operation) {
        try {
            return await operation();
        }
        catch (error) {
            throw mapMarketplaceErrorToAdapterError(error);
        }
    }

    /**
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime | undefined} runtime
     * @param {string} operationName
     */
    assertRuntime(runtime, operationName) {
        if (runtime === undefined) {
            throw new MarketplaceUnsupportedError(`Missing marketplace runtime for ${operationName}`);
        }
    }
}
