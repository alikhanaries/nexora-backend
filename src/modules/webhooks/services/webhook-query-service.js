import { GetWebhookSubscription } from './get-webhook-subscription.js';
import { ListWebhookSubscriptions } from './list-webhook-subscriptions.js';
import { ListWebhookDeliveries } from './list-webhook-deliveries.js';
import { GetWebhookDelivery } from './get-webhook-delivery.js';

export class DefaultWebhookQueryService {
    getSubscription;
    listSubscriptions;
    listDeliveries;
    getDelivery;
    constructor(deps) {
        this.getSubscription = new GetWebhookSubscription(deps);
        this.listSubscriptions = new ListWebhookSubscriptions(deps);
        this.listDeliveries = new ListWebhookDeliveries(deps);
        this.getDelivery = new GetWebhookDelivery(deps);
    }
    async getWebhookSubscription(input) {
        return this.getSubscription.execute(input);
    }
    async listWebhookSubscriptions(input) {
        return this.listSubscriptions.execute(input);
    }
    async listWebhookDeliveries(input) {
        return this.listDeliveries.execute(input);
    }
    async getWebhookDelivery(input) {
        return this.getDelivery.execute(input);
    }
}
