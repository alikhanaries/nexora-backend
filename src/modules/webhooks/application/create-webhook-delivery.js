import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../../shared/errors/index.js';
import { WebhookDelivery } from '../domain/webhook-delivery.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { toWebhookDeliveryDto } from './webhook-delivery-dto.js';

/**
 * Persists a pending delivery row for a subscription and integration event.
 * Used by future dispatch workers — not exposed over HTTP in Phase 6.2.
 */
export class CreateWebhookDelivery {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        const now = new Date();
        const delivery = await this.deps.database.execute(async (tx) => {
            const subscription = await this.deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (subscription === null || subscription.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const pending = WebhookDelivery.createPending({
                id: randomUUID(),
                tenantId: input.tenantId,
                subscriptionId: input.subscriptionId,
                eventId: input.eventId,
                eventType: input.eventType,
                nextAttemptAt: input.nextAttemptAt ?? null,
                createdAt: now,
            });
            await this.deps.deliveries.insert(tx, pending);
            return pending;
        }, { tenantId: input.tenantId });
        return { delivery: toWebhookDeliveryDto(delivery) };
    }
}
