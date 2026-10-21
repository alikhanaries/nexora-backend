import { ValidationError } from '../../../../shared/errors/index.js';

/**
 * @returns {{
 *   register: (adapter: import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter) => void,
 *   resolve: (marketplaceKey: string) => import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter | null,
 *   listAdapters: () => readonly import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter[],
 * }}
 */
export function createMarketplaceOrderAdapterRegistry() {
    /** @type {Map<string, import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter>} */
    const adapters = new Map();

    /**
     * @param {import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter} adapter
     */
    function register(adapter) {
        const key = adapter.marketplaceKey?.trim();
        if (key === undefined || key.length === 0) {
            throw new ValidationError('Marketplace order adapter must declare marketplaceKey');
        }
        adapters.set(key, adapter);
    }

    /**
     * @param {string} marketplaceKey
     */
    function resolve(marketplaceKey) {
        return adapters.get(marketplaceKey) ?? null;
    }

    /** @returns {readonly import('./marketplace-order-adapter.port.js').MarketplaceOrderAdapter[]} */
    function listAdapters() {
        return [...adapters.values()];
    }

    return { register, resolve, listAdapters };
}
