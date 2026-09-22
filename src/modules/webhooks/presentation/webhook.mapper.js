/**
 * Maps application DTOs to safe HTTP responses without secrets or ciphertext.
 *
 * @param {object} subscription
 */
export function toWebhookSubscriptionResponse(subscription) {
    return {
        id: subscription.id,
        url: subscription.url,
        description: subscription.description,
        eventTypes: subscription.eventTypes,
        status: subscription.status,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
    };
}

/**
 * @param {object} delivery
 */
export function toWebhookDeliveryResponse(delivery) {
    return {
        id: delivery.id,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        nextAttemptAt: delivery.nextAttemptAt,
        lastHttpStatus: delivery.lastHttpStatus,
        lastError: delivery.lastError,
        deliveredAt: delivery.deliveredAt,
        createdAt: delivery.createdAt,
    };
}
