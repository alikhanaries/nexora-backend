import { NotFoundError } from '../../../shared/errors/index.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksRead } from './webhook-permissions.js';

export class GetWebhookSubscription {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksRead(this.deps.authorization, input.actorPermissions);
        const subscription = await this.deps.database.execute(async (tx) => this.deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId), { tenantId: input.tenantId });
        if (subscription === null || subscription.status === WebhookSubscriptionStatus.DELETED) {
            throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
        }
        return { subscription: toWebhookSubscriptionDto(subscription) };
    }
}
