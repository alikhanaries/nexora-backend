/**
 * Aggregates outbound webhook mutation use cases (subscriptions, deliveries, secret rotation).
 */
import { createCreateWebhookSubscription } from './create-webhook-subscription.js';
import { createUpdateWebhookSubscription } from './update-webhook-subscription.js';
import { createDisableWebhookSubscription } from './disable-webhook-subscription.js';
import { createDeleteWebhookSubscription } from './delete-webhook-subscription.js';
import { createCreateWebhookDelivery } from './create-webhook-delivery.js';
import { createRotateWebhookSecret } from './rotate-webhook-secret.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createDefaultWebhookCommandService(deps) {
    const createSubscription = createCreateWebhookSubscription(deps);
    const updateSubscription = createUpdateWebhookSubscription(deps);
    const disableSubscription = createDisableWebhookSubscription(deps);
    const deleteSubscription = createDeleteWebhookSubscription(deps);
    const createDelivery = createCreateWebhookDelivery(deps);
    const rotateSecret = createRotateWebhookSecret(deps);
    return {
        /**
         * Factory closing over shared deps for webhook module services.
         */
        async createWebhookSubscription(input) {
            return createSubscription.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async updateWebhookSubscription(input) {
            return updateSubscription.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async disableWebhookSubscription(input) {
            return disableSubscription.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async deleteWebhookSubscription(input) {
            return deleteSubscription.execute(input);
        },
        /**
         * Factory closing over shared deps for webhook module services.
         */
        async createWebhookDelivery(input) {
            return createDelivery.execute(input);
        },
        /**
         * Delegates to focused use-case factory method on webhook command/query service.
         */
        async rotateWebhookSecret(input) {
            return rotateSecret.execute(input);
        },
    };
}
