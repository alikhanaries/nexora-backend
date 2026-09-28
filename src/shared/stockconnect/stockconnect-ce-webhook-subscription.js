/**
 * Webhook subscriptions whose `description` equals this value receive
 * CE-compatible order payloads for StockConnect order webhook ingestion.
 */
export const STOCKCONNECT_CE_BRIDGE_SUBSCRIPTION_DESCRIPTION = 'stockconnect-ce-bridge';

/** Integration events translated to CE order webhook bodies for StockConnect. */
export const STOCKCONNECT_CE_BRIDGE_ORDER_EVENT_TYPES = Object.freeze([
    'order.created',
    'order.confirmed',
    'order.status_changed',
    'order.cancelled',
]);

/**
 * @param {{ description?: string | null }} subscription
 */
export function isStockConnectCeBridgeSubscription(subscription) {
    const description = subscription.description?.trim();
    return description === STOCKCONNECT_CE_BRIDGE_SUBSCRIPTION_DESCRIPTION;
}
