import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';
import { validateWebhookEventTypes } from './validate-webhook-event-types.js';
import { validateWebhookUrl } from './validate-webhook-url.js';

export class UpdateWebhookSubscription {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksManage(this.deps.authorization, input.actorPermissions);
        if (input.status !== undefined
            && input.status !== WebhookSubscriptionStatus.ACTIVE
            && input.status !== WebhookSubscriptionStatus.DISABLED) {
            throw new ValidationError('Webhook subscription status must be ACTIVE or DISABLED');
        }
        const now = new Date();
        const updated = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (existing === null || existing.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const next = existing.updateDetails({
                ...(input.url === undefined ? {} : { url: validateWebhookUrl(input.url) }),
                ...(input.description === undefined ? {} : { description: input.description?.trim() || null }),
                ...(input.eventTypes === undefined ? {} : { eventTypes: validateWebhookEventTypes(input.eventTypes) }),
                ...(input.status === undefined ? {} : { status: input.status }),
            }, now);
            await this.deps.subscriptions.update(tx, next);
            if (this.deps.auditRecorder !== undefined) {
                await this.deps.auditRecorder.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'WEBHOOK_SUBSCRIPTION_UPDATED',
                    resourceType: 'webhook_subscription',
                    resourceId: next.id,
                    metadata: {
                        status: next.status,
                        eventTypes: next.eventTypes,
                    },
                });
            }
            return next;
        }, { tenantId: input.tenantId });
        return { subscription: toWebhookSubscriptionDto(updated) };
    }
}
