import { buildWebhookEventEnvelope } from './build-webhook-event-envelope.js';

/**
 * Optional adapter for formatting outbound webhook HTTP bodies per subscription profile.
 * Generic delivery (HMAC, retry, idempotency) stays in {@link WebhookDeliveryService}.
 *
 * @typedef {object} WebhookPayloadStrategy
 * @property {(subscription: import('../domain/webhook-subscription.js').WebhookSubscription) => boolean} matches
 * @property {(
 *   subscription: import('../domain/webhook-subscription.js').WebhookSubscription,
 *   event: import('../../../shared/events/integration-event.js').IntegrationEvent,
 * ) => Promise<string|null>} buildBody
 */

/**
 * @param {readonly WebhookPayloadStrategy[]|undefined} strategies
 * @param {import('../domain/webhook-subscription.js').WebhookSubscription} subscription
 * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
 * @returns {Promise<string|null>}
 */
export async function resolveWebhookRequestBody(strategies, subscription, event) {
    if (strategies !== undefined) {
        for (const strategy of strategies) {
            if (strategy.matches(subscription)) {
                return strategy.buildBody(subscription, event);
            }
        }
    }
    return buildWebhookEventEnvelope(event);
}
