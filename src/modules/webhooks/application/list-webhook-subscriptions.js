import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksRead } from './webhook-permissions.js';

export class ListWebhookSubscriptions {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksRead(this.deps.authorization, input.actorPermissions);
        const statuses = input.includeDeleted === true
            ? undefined
            : [WebhookSubscriptionStatus.ACTIVE, WebhookSubscriptionStatus.DISABLED];
        const subscriptions = await this.deps.database.execute(async (tx) => this.deps.subscriptions.list(tx, input.tenantId, statuses === undefined ? {} : { statuses }), { tenantId: input.tenantId });
        return {
            items: subscriptions.map((subscription) => toWebhookSubscriptionDto(subscription)),
        };
    }
}
