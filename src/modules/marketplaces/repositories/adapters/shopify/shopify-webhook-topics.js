/** Shopify Admin webhook topics handled in Phase 33 (lifecycle-relevant only). */
export const ShopifyWebhookTopic = Object.freeze({
    ORDERS_CREATE: 'orders/create',
    ORDERS_UPDATED: 'orders/updated',
    ORDERS_CANCELLED: 'orders/cancelled',
    REFUNDS_CREATE: 'refunds/create',
    FULFILLMENTS_CREATE: 'fulfillments/create',
});

export const SUPPORTED_SHOPIFY_WEBHOOK_TOPICS = new Set(Object.values(ShopifyWebhookTopic));
