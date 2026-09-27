import { MarketplaceOrderLifecycleUnsupportedError } from '../../marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';

export class MarketplaceOutboundOrderLifecycleAdapterRegistry {
    /** @type {Map<string, import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleAdapter>} */
    adapters = new Map();

    /**
     * @param {import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleAdapter} adapter
     */
    register(adapter) {
        this.adapters.set(adapter.marketplaceKey, adapter);
    }

    /**
     * @param {string} marketplaceKey
     */
    resolve(marketplaceKey) {
        return this.adapters.get(marketplaceKey) ?? null;
    }

    /**
     * @param {string} marketplaceKey
     * @param {string} capabilityKey
     */
    requireAdapter(marketplaceKey, capabilityKey) {
        const adapter = this.resolve(marketplaceKey);
        if (adapter === null) {
            throw new MarketplaceOrderLifecycleUnsupportedError(capabilityKey, marketplaceKey);
        }
        const caps = adapter.getLifecycleCapabilities?.();
        if (caps === undefined || caps[capabilityKey] !== true) {
            throw new MarketplaceOrderLifecycleUnsupportedError(capabilityKey, marketplaceKey);
        }
        return adapter;
    }
}
