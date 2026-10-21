import { NotFoundError, RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { WebhookSubscriptionStatus } from '../models/webhook-subscription-status.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksRead } from './webhook-permissions.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createGetWebhookSubscription(deps) {
    /**
     * Tenant-scoped webhook subscription/delivery command; enforces webhooks.manage where required.
     */
    async function execute(input) {
        requireWebhooksRead(deps.authorization, input.actorPermissions);
        const rateLimit = await deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookRead,
            subject: `${input.tenantId}:${input.actorId ?? input.tenantId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const subscription = await deps.database.execute(async (tx) => deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId), { tenantId: input.tenantId });
        if (subscription === null || subscription.status === WebhookSubscriptionStatus.DELETED) {
            throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
        }
        return { subscription: toWebhookSubscriptionDto(subscription) };
    }
    return { execute };
}
