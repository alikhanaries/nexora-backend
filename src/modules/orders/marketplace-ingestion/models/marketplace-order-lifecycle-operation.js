/** Provider-neutral marketplace order lifecycle operations (Phase 31). */
export const MarketplaceOrderLifecycleOperation = Object.freeze({
    UPDATE_ORDER: 'update_order',
    CANCEL_ORDER: 'cancel_order',
    RETURN_ORDER: 'return_order',
    REFUND_ORDER: 'refund_order',
    FULFILL_ORDER: 'fulfill_order',
    SHIPMENT_UPDATE: 'shipment_update',
    STATUS_SYNC: 'status_sync',
});

/** @typedef {typeof MarketplaceOrderLifecycleOperation[keyof typeof MarketplaceOrderLifecycleOperation]} MarketplaceOrderLifecycleOperationType */

const OPERATION_SET = new Set(Object.values(MarketplaceOrderLifecycleOperation));

/**
 * @param {string} value
 */
export function isMarketplaceOrderLifecycleOperation(value) {
    return OPERATION_SET.has(value);
}
