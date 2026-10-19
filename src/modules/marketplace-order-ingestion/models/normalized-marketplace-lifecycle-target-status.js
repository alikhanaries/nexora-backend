/** Target order status for inbound marketplace status synchronization. */
export const NormalizedMarketplaceLifecycleTargetStatus = Object.freeze({
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    FULFILLED: 'fulfilled',
    RETURNED: 'returned',
    UNKNOWN: 'unknown',
});

const TARGET_SET = new Set(Object.values(NormalizedMarketplaceLifecycleTargetStatus));

/**
 * @param {string} value
 */
export function isNormalizedMarketplaceLifecycleTargetStatus(value) {
    return TARGET_SET.has(value);
}
