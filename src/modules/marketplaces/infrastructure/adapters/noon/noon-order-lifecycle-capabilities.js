/**
 * Noon FBPI order lifecycle capabilities (Phase 35).
 * Based on Partners Event Notifications + FBPI order APIs documented at noonpartners.dev.
 */
export function noonOrderLifecycleCapabilities() {
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
