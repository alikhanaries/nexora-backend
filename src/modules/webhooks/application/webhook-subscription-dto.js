/** @typedef {import('../domain/webhook-subscription.js').WebhookSubscription} WebhookSubscription */

/**
 * @param {WebhookSubscription} subscription
 * @returns {object}
 */
export function toWebhookSubscriptionDto(subscription) {
    return {
        id: subscription.id,
        tenantId: subscription.tenantId,
        url: subscription.url,
        description: subscription.description,
        eventTypes: [...subscription.eventTypes],
        status: subscription.status,
        createdBy: subscription.createdBy,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
    };
}
