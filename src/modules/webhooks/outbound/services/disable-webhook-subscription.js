import { auditRequestFields } from '../../../audit/public/index.js';
import { NotFoundError, RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { WebhookSubscriptionStatus } from '../models/webhook-subscription-status.js';
import { disableWebhookSubscriptionEntity } from '../models/webhook-subscription.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createDisableWebhookSubscription(deps) {
    /**
     * Tenant-scoped webhook subscription/delivery command; enforces webhooks.manage where required.
     */
    async function execute(input) {
        requireWebhooksManage(deps.authorization, input.actorPermissions);
        const rateLimit = await deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookManage,
            subject: `${input.tenantId}:${input.actorId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const now = new Date();
        const updated = await deps.database.execute(async (tx) => {
            const existing = await deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (existing === null || existing.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const next = disableWebhookSubscriptionEntity(existing, now);
            await deps.subscriptions.update(tx, next);
            if (deps.auditRecorder !== undefined) {
                await deps.auditRecorder.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'WEBHOOK_SUBSCRIPTION_DISABLED',
                    resourceType: 'webhook_subscription',
                    resourceId: next.id,
                    metadata: {},
                    ...auditRequestFields(),
                });
            }
            return next;
        }, { tenantId: input.tenantId });
        return { subscription: toWebhookSubscriptionDto(updated) };
    }
    return { execute };
}
