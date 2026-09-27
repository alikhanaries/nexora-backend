/**
 * @typedef {import('./marketplace-order-adapter.port.js').MarketplaceOrderLifecycleCapabilities} MarketplaceOrderLifecycleCapabilities
 */

/** Default lifecycle capabilities — all unsupported until a provider opts in. */
export function defaultMarketplaceOrderLifecycleCapabilities() {
    return {
        supportsOrderUpdate: false,
        supportsOrderCancel: false,
        supportsOrderReturn: false,
        supportsOrderRefund: false,
        supportsOrderFulfill: false,
        supportsShipmentUpdate: false,
        supportsOrderStatusSync: false,
    };
}
