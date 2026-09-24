import { ValidationError } from '../../../shared/errors/index.js';

export class MarketplaceOrderAdapterRegistry {
    /** @type {Map<string, import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter>} */
    #adapters = new Map();

    /**
     * @param {import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter} adapter
     */
    register(adapter) {
        const key = adapter.marketplaceKey?.trim();
        if (key === undefined || key.length === 0) {
            throw new ValidationError('Marketplace order adapter must declare marketplaceKey');
        }
        this.#adapters.set(key, adapter);
    }

    /**
     * @param {string} marketplaceKey
     */
    resolve(marketplaceKey) {
        return this.#adapters.get(marketplaceKey) ?? null;
    }

    /** @returns {readonly import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter[]} */
    listAdapters() {
        return [...this.#adapters.values()];
    }
}
