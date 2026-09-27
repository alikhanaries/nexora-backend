/**
 * Amazon SP-API order lifecycle capabilities (Phase 34).
 * Flags reflect inbound notifications + generic executor support, not every SP-API operation.
 */
export function amazonOrderLifecycleCapabilities() {
    return {
        supportsOrderUpdate: false,
        supportsOrderCancel: true,
        supportsOrderReturn: false,
        supportsOrderRefund: false,
        supportsOrderFulfill: false,
        supportsShipmentUpdate: false,
        supportsOrderStatusSync: true,
    };
}
