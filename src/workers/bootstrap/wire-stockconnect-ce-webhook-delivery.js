import { createStockConnectCeWebhookBodyBuilder } from '../../modules/compatibility/application/build-stockconnect-ce-webhook-body.js';

/**
 * @deprecated Prefer {@link wireExternalConsumerWebhookPayloadStrategies} for worker webhook wiring.
 * Retained for composition paths that only need the legacy external order body builder.
 */
export function wireStockConnectCeWebhookDelivery(deps) {
    return createStockConnectCeWebhookBodyBuilder(deps);
}

export { wireExternalConsumerWebhookPayloadStrategies } from './wire-external-consumer-webhook-payload-strategies.js';
