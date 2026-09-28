import { createStockConnectCeWebhookBodyBuilder } from '../../modules/compatibility/application/build-stockconnect-ce-webhook-body.js';

/**
 * Worker-only wiring for StockConnect CE webhook payload mapping.
 *
 * @param {object} deps
 * @param {import('../../modules/orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
 * @param {import('../../modules/channels/public/channel-query-service.js').DefaultChannelQueryService} deps.channelQueryService
 * @param {import('../../modules/external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} deps.externalIntegerIdMappingQueryService
 */
export function wireStockConnectCeWebhookDelivery(deps) {
    return createStockConnectCeWebhookBodyBuilder(deps);
}
