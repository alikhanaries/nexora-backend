import { WebhookDeliveryStatus } from './webhook-delivery-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   subscriptionId: string,
 *   eventId: string,
 *   eventType: string,
 *   status: string,
 *   attemptCount: number,
 *   nextAttemptAt: Date | null,
 *   lastHttpStatus: number | null,
 *   lastError: string | null,
 *   deliveredAt: Date | null,
 *   createdAt: Date,
 * }} WebhookDelivery
 */

/**
 * @param {object} props
 * @returns {WebhookDelivery}
 */
export function createPendingWebhookDelivery(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        subscriptionId: props.subscriptionId,
        eventId: props.eventId,
        eventType: props.eventType,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: props.nextAttemptAt ?? null,
        lastHttpStatus: null,
        lastError: null,
        deliveredAt: null,
        createdAt: props.createdAt,
    };
}

/**
 * @param {WebhookDelivery} props
 * @returns {WebhookDelivery}
 */
export function reconstituteWebhookDelivery(props) {
    return { ...props };
}
