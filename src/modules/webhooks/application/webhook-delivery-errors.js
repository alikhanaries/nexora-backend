/**
 * Signals that BullMQ should retry the webhook delivery job.
 */
export class WebhookDeliveryRetryError extends Error {
    constructor(message = 'Webhook delivery should be retried') {
        super(message);
        this.name = 'WebhookDeliveryRetryError';
    }
}

/**
 * @param {unknown} error
 * @param {number} [maxLength=1000]
 */
export function sanitizeWebhookDeliveryError(error, maxLength = 1_000) {
    const message = error instanceof Error ? error.message : 'Webhook delivery failed';
    return message.length <= maxLength ? message : message.slice(0, maxLength);
}
