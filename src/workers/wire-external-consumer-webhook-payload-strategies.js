import { createCompatV2WebhookBodyBuilder } from '../modules/compatibility/services/build-compat-v2-webhook-body.js';
import { isCompatV2BridgeSubscription } from '../shared/stockconnect/compat-v2-webhook-bridge.js';

/**
 * Registers webhook payload strategies for external compatibility consumers.
 * Wired at the worker composition root — core webhook delivery stays consumer-agnostic.
 *
 * @param {object} deps
 * @param {import('../modules/orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
 * @param {import('../modules/commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../modules/external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} deps.externalIntegerIdMappingQueryService
 * @returns {import('../modules/webhooks/outbound/services/webhook-payload-strategy.js').WebhookPayloadStrategy[]}
 */
export function wireExternalConsumerWebhookPayloadStrategies(deps) {
    const externalCompatibilityOrderBodyBuilder = createCompatV2WebhookBodyBuilder(deps);
    return [
        {
            matches: isCompatV2BridgeSubscription,
            buildBody: (_subscription, event) => externalCompatibilityOrderBodyBuilder(event),
        },
    ];
}
