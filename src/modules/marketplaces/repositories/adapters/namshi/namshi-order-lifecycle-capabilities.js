/**
 * Namshi FBPI order lifecycle capabilities (Phase 36).
 * Flags reflect verified FBPI APIs/events and generic executor support.
 */
export function namshiOrderLifecycleCapabilities() {
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
