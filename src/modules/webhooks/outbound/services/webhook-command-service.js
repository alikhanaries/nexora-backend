import { createCreateWebhookSubscription } from './create-webhook-subscription.js';
import { createUpdateWebhookSubscription } from './update-webhook-subscription.js';
import { createDisableWebhookSubscription } from './disable-webhook-subscription.js';
import { createDeleteWebhookSubscription } from './delete-webhook-subscription.js';
import { createCreateWebhookDelivery } from './create-webhook-delivery.js';
import { createRotateWebhookSecret } from './rotate-webhook-secret.js';

export function createDefaultWebhookCommandService(deps) {
    const createSubscription = createCreateWebhookSubscription(deps);
    const updateSubscription = createUpdateWebhookSubscription(deps);
    const disableSubscription = createDisableWebhookSubscription(deps);
    const deleteSubscription = createDeleteWebhookSubscription(deps);
    const createDelivery = createCreateWebhookDelivery(deps);
    const rotateSecret = createRotateWebhookSecret(deps);
    return {
        async createWebhookSubscription(input) {
            return createSubscription.execute(input);
        },
        async updateWebhookSubscription(input) {
            return updateSubscription.execute(input);
        },
        async disableWebhookSubscription(input) {
            return disableSubscription.execute(input);
        },
        async deleteWebhookSubscription(input) {
            return deleteSubscription.execute(input);
        },
        async createWebhookDelivery(input) {
            return createDelivery.execute(input);
        },
        async rotateWebhookSecret(input) {
            return rotateSecret.execute(input);
        },
    };
}
