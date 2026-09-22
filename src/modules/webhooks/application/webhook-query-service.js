import { GetWebhookSubscription } from './get-webhook-subscription.js';
import { ListWebhookSubscriptions } from './list-webhook-subscriptions.js';

export class DefaultWebhookQueryService {
    getSubscription;
    listSubscriptions;
    constructor(deps) {
        this.getSubscription = new GetWebhookSubscription(deps);
        this.listSubscriptions = new ListWebhookSubscriptions(deps);
    }
    async getWebhookSubscription(input) {
        return this.getSubscription.execute(input);
    }
    async listWebhookSubscriptions(input) {
        return this.listSubscriptions.execute(input);
    }
}
