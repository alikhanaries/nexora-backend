/**
 * Signals that BullMQ should retry the webhook delivery job.
 */
export class WebhookDeliveryRetryError extends Error {
    /** @type {number | null} */
    retryDelayMs;

    /**
     * @param {string} [message]
     * @param {{ retryDelayMs?: number | null }} [options]
     */
    constructor(message = 'Webhook delivery should be retried', options = {}) {
        super(message);
        this.name = 'WebhookDeliveryRetryError';
        this.retryDelayMs = options.retryDelayMs ?? null;
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
