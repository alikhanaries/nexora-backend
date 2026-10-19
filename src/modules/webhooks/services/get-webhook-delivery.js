import { NotFoundError, RateLimitError } from '../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../shared/auth/rate-limit-policies.js';
import { toWebhookDeliveryDto } from './webhook-delivery-dto.js';
import { requireWebhooksRead } from './webhook-permissions.js';

export class GetWebhookDelivery {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksRead(this.deps.authorization, input.actorPermissions);
        const rateLimit = await this.deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookRead,
            subject: `${input.tenantId}:${input.actorId ?? input.tenantId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const delivery = await this.deps.database.execute(async (tx) => {
            const subscription = await this.deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (subscription === null) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const found = await this.deps.deliveries.findById(tx, input.tenantId, input.deliveryId);
            if (found === null || found.subscriptionId !== input.subscriptionId) {
                throw new NotFoundError('Webhook delivery was not found', { deliveryId: input.deliveryId });
            }
            return found;
        }, { tenantId: input.tenantId });
        return { delivery: toWebhookDeliveryDto(delivery) };
    }
}
