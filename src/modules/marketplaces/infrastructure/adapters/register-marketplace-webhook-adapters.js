/**
 * Composition-root registration for inbound marketplace webhook adapters.
 * Provider implementations (Shopify, Amazon, …) register in later phases — not Phase 32.
 *
 * @param {import('../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter-registry.js').MarketplaceWebhookAdapterRegistry} _registry
 */
export function registerMarketplaceWebhookAdapters(_registry) {
    // Intentionally empty in Phase 32 (generic framework only).
}
