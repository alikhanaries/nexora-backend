/** Provider-neutral marketplace webhook event kinds (adapter output). */
export const MarketplaceWebhookEventKind = Object.freeze({
    ORDER_CREATE: 'order.create',
    ORDER_UPDATE: 'order.update',
});

export const SUPPORTED_MARKETPLACE_WEBHOOK_EVENT_KINDS = new Set(Object.values(MarketplaceWebhookEventKind));
