/**
 * Webhook subscriptions whose `description` equals this value receive
 * Compat v2 order payloads for StockConnect order webhook ingestion.
 */
export const COMPAT_V2_WEBHOOK_BRIDGE_SUBSCRIPTION_DESCRIPTION = 'stockconnect-ce-bridge';

/** Integration events translated to compat v2 order webhook bodies for StockConnect. */
export const COMPAT_V2_WEBHOOK_BRIDGE_ORDER_EVENT_TYPES = Object.freeze([
    'order.created',
    'order.confirmed',
    'order.status_changed',
    'order.cancelled',
]);

/**
 * @param {{ description?: string | null }} subscription
 */
export function isCompatV2BridgeSubscription(subscription) {
    const description = subscription.description?.trim();
    return description === COMPAT_V2_WEBHOOK_BRIDGE_SUBSCRIPTION_DESCRIPTION;
}
