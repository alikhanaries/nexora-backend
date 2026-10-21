import { NotFoundError, RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { toWebhookDeliveryDto } from './webhook-delivery-dto.js';
import { requireWebhooksRead } from './webhook-permissions.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createGetWebhookDelivery(deps) {
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
        const delivery = await deps.database.execute(async (tx) => {
            const subscription = await deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (subscription === null) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const found = await deps.deliveries.findById(tx, input.tenantId, input.deliveryId);
            if (found === null || found.subscriptionId !== input.subscriptionId) {
                throw new NotFoundError('Webhook delivery was not found', { deliveryId: input.deliveryId });
            }
            return found;
        }, { tenantId: input.tenantId });
        return { delivery: toWebhookDeliveryDto(delivery) };
    }
    return { execute };
}
