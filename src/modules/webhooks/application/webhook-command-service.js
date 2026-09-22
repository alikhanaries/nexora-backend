import { CreateWebhookSubscription } from './create-webhook-subscription.js';
import { UpdateWebhookSubscription } from './update-webhook-subscription.js';
import { DisableWebhookSubscription } from './disable-webhook-subscription.js';
import { DeleteWebhookSubscription } from './delete-webhook-subscription.js';
import { CreateWebhookDelivery } from './create-webhook-delivery.js';

export class DefaultWebhookCommandService {
    createSubscription;
    updateSubscription;
    disableSubscription;
    deleteSubscription;
    createDelivery;
    constructor(deps) {
        this.createSubscription = new CreateWebhookSubscription(deps);
        this.updateSubscription = new UpdateWebhookSubscription(deps);
        this.disableSubscription = new DisableWebhookSubscription(deps);
        this.deleteSubscription = new DeleteWebhookSubscription(deps);
        this.createDelivery = new CreateWebhookDelivery(deps);
    }
    async createWebhookSubscription(input) {
        return this.createSubscription.execute(input);
    }
    async updateWebhookSubscription(input) {
        return this.updateSubscription.execute(input);
    }
    async disableWebhookSubscription(input) {
        return this.disableSubscription.execute(input);
    }
    async deleteWebhookSubscription(input) {
        return this.deleteSubscription.execute(input);
    }
    async createWebhookDelivery(input) {
        return this.createDelivery.execute(input);
    }
}
