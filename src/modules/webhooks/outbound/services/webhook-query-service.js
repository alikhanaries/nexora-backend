import { createGetWebhookSubscription } from './get-webhook-subscription.js';
import { createListWebhookSubscriptions } from './list-webhook-subscriptions.js';
import { createListWebhookDeliveries } from './list-webhook-deliveries.js';
import { createGetWebhookDelivery } from './get-webhook-delivery.js';

export function createDefaultWebhookQueryService(deps) {
    const getSubscription = createGetWebhookSubscription(deps);
    const listSubscriptions = createListWebhookSubscriptions(deps);
    const listDeliveries = createListWebhookDeliveries(deps);
    const getDelivery = createGetWebhookDelivery(deps);
    return {
        async getWebhookSubscription(input) {
            return getSubscription.execute(input);
        },
        async listWebhookSubscriptions(input) {
            return listSubscriptions.execute(input);
        },
        async listWebhookDeliveries(input) {
            return listDeliveries.execute(input);
        },
        async getWebhookDelivery(input) {
            return getDelivery.execute(input);
        },
    };
}
