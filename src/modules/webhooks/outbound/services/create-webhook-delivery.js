/**
 * Creates a pending delivery row when manually replaying or testing a subscription endpoint.
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../../../shared/errors/index.js';
import { createPendingWebhookDelivery } from '../models/webhook-delivery.js';
import { WebhookSubscriptionStatus } from '../models/webhook-subscription-status.js';
import { toWebhookDeliveryDto } from './webhook-delivery-dto.js';

/**
 * Persists a pending delivery row for a subscription and integration event.
 * Used by future dispatch workers — not exposed over HTTP in Phase 6.2.
 */
export function createCreateWebhookDelivery(deps) {
    /**
     * Tenant-scoped webhook subscription/delivery command; enforces webhooks.manage where required.
     */
    async function execute(input) {
        const now = new Date();
        const delivery = await deps.database.execute(async (tx) => {
            const subscription = await deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (subscription === null || subscription.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const pending = createPendingWebhookDelivery({
                id: randomUUID(),
                tenantId: input.tenantId,
                subscriptionId: input.subscriptionId,
                eventId: input.eventId,
                eventType: input.eventType,
                nextAttemptAt: input.nextAttemptAt ?? null,
                createdAt: now,
            });
            await deps.deliveries.insert(tx, pending);
            return pending;
        }, { tenantId: input.tenantId });
        return { delivery: toWebhookDeliveryDto(delivery) };
    }
    return { execute };
}
