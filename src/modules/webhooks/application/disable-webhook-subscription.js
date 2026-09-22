import { NotFoundError } from '../../../shared/errors/index.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';

export class DisableWebhookSubscription {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksManage(this.deps.authorization, input.actorPermissions);
        const now = new Date();
        const updated = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (existing === null || existing.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const next = existing.disable(now);
            await this.deps.subscriptions.update(tx, next);
            if (this.deps.auditRecorder !== undefined) {
                await this.deps.auditRecorder.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'WEBHOOK_SUBSCRIPTION_DISABLED',
                    resourceType: 'webhook_subscription',
                    resourceId: next.id,
                    metadata: {},
                });
            }
            return next;
        }, { tenantId: input.tenantId });
        return { subscription: toWebhookSubscriptionDto(updated) };
    }
}
