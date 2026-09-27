export class MarketplaceWebhookAdapterRegistry {
    /** @type {Map<string, import('./marketplace-webhook-adapter.port.js').MarketplaceWebhookAdapter>} */
    #adapters = new Map();

    /**
     * @param {import('./marketplace-webhook-adapter.port.js').MarketplaceWebhookAdapter} adapter
     */
    register(adapter) {
        this.#adapters.set(adapter.marketplaceKey, adapter);
    }

    /**
     * @param {string} marketplaceKey
     * @returns {import('./marketplace-webhook-adapter.port.js').MarketplaceWebhookAdapter | null}
     */
    resolve(marketplaceKey) {
        return this.#adapters.get(marketplaceKey) ?? null;
    }

    /** @returns {readonly import('./marketplace-webhook-adapter.port.js').MarketplaceWebhookAdapter[]} */
    list() {
        return [...this.#adapters.values()];
    }
}
