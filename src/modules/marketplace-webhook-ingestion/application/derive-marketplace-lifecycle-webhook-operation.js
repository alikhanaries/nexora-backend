import { MarketplaceWebhookEventKind } from '../domain/marketplace-webhook-event-kind.js';

/**
 * @param {import('./normalized-marketplace-webhook-event.schema.js').NormalizedMarketplaceWebhookEvent} event
 */
export function deriveMarketplaceLifecycleWebhookOperation(event) {
    switch (event.eventKind) {
        case MarketplaceWebhookEventKind.ORDER_CREATE:
            return 'ingest_order';
        case MarketplaceWebhookEventKind.ORDER_UPDATE:
            if ('lifecyclePayload' in event.resource) {
                return 'apply_lifecycle_payload';
            }
            return 'status_sync';
        default:
            return 'unsupported_webhook';
    }
}

/**
 * @param {import('./normalized-marketplace-webhook-event.schema.js').NormalizedMarketplaceWebhookEvent} event
 */
export function externalOrderIdFromWebhookEvent(event) {
    if ('order' in event.resource) {
        return event.resource.order.externalOrderId;
    }
    return event.deduplicationKey;
}
