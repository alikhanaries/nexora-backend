import { createCompatV2WebhookBodyBuilder } from '../modules/compatibility/services/build-compat-v2-webhook-body.js';

/**
 * @deprecated Prefer {@link wireExternalConsumerWebhookPayloadStrategies} for worker webhook wiring.
 * Retained for composition paths that only need the legacy external order body builder.
 */
export function wireStockConnectCeWebhookDelivery(deps) {
    return createCompatV2WebhookBodyBuilder(deps);
}

export { wireExternalConsumerWebhookPayloadStrategies } from './wire-external-consumer-webhook-payload-strategies.js';
