/** @typedef {import('../domain/webhook-delivery.js').WebhookDelivery} WebhookDelivery */

/**
 * @param {WebhookDelivery} delivery
 * @returns {object}
 */
export function toWebhookDeliveryDto(delivery) {
    return {
        id: delivery.id,
        tenantId: delivery.tenantId,
        subscriptionId: delivery.subscriptionId,
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
        lastHttpStatus: delivery.lastHttpStatus,
        lastError: delivery.lastError,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
    };
}
