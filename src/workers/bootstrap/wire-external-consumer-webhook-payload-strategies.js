import { createStockConnectCeWebhookBodyBuilder } from '../../modules/compatibility/application/build-stockconnect-ce-webhook-body.js';
import { isStockConnectCeBridgeSubscription } from '../../shared/stockconnect/stockconnect-ce-webhook-subscription.js';

/**
 * Registers webhook payload strategies for external compatibility consumers.
 * Wired at the worker composition root — core webhook delivery stays consumer-agnostic.
 *
 * @param {object} deps
 * @param {import('../../modules/orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
 * @param {import('../../modules/channels/public/channel-query-service.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('../../modules/external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} deps.externalIntegerIdMappingQueryService
 * @returns {import('../../modules/webhooks/application/webhook-payload-strategy.js').WebhookPayloadStrategy[]}
 */
export function wireExternalConsumerWebhookPayloadStrategies(deps) {
    const externalCompatibilityOrderBodyBuilder = createStockConnectCeWebhookBodyBuilder(deps);
    return [
        {
            matches: isStockConnectCeBridgeSubscription,
            buildBody: (_subscription, event) => externalCompatibilityOrderBodyBuilder(event),
        },
    ];
}
