import { createGetWebhookSubscription } from './get-webhook-subscription.js';
import { createListWebhookSubscriptions } from './list-webhook-subscriptions.js';
import { createListWebhookDeliveries } from './list-webhook-deliveries.js';
import { createGetWebhookDelivery } from './get-webhook-delivery.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createDefaultWebhookQueryService(deps) {
    const getSubscription = createGetWebhookSubscription(deps);
    const listSubscriptions = createListWebhookSubscriptions(deps);
    const listDeliveries = createListWebhookDeliveries(deps);
    const getDelivery = createGetWebhookDelivery(deps);
    return {
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async getWebhookSubscription(input) {
            return getSubscription.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async listWebhookSubscriptions(input) {
            return listSubscriptions.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async listWebhookDeliveries(input) {
            return listDeliveries.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async getWebhookDelivery(input) {
            return getDelivery.execute(input);
        },
    };
}
