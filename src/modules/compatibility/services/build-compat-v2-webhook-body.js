import { loadOrderExternalIdMaps } from './compatibility-external-id-enrichment.js';
import { mapCompatV2Order } from './mappers/compat-v2-order.mapper.js';
import { COMPAT_V2_WEBHOOK_BRIDGE_ORDER_EVENT_TYPES } from '../../../shared/stockconnect/compat-v2-webhook-bridge.js';

/**
 * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
 */
function readOrderIdFromEvent(event) {
    const orderId = event.payload?.orderId;
    return typeof orderId === 'string' && orderId.trim().length > 0 ? orderId.trim() : null;
}

/**
 * Builds the HTTP body StockConnect expects on `POST /orders/channelengine-webhook`
 * (compat v2 collection envelope with a single order in `Content`).
 *
 * @param {object} deps
 * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
 * @param {import('../../commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} deps.externalIntegerIdMappingQueryService
 * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
 * @returns {Promise<string|null>} UTF-8 JSON body, or null when the event cannot be mapped
 */
export async function buildCompatV2WebhookBody(deps, event) {
    if (!COMPAT_V2_WEBHOOK_BRIDGE_ORDER_EVENT_TYPES.includes(event.type)) {
        return null;
    }
    const orderId = readOrderIdFromEvent(event);
    if (orderId === null || event.tenantId === null) {
        return null;
    }
    const order = await deps.orderQueryService.findOrderById(event.tenantId, orderId);
    if (order === null) {
        return null;
    }
    const lines = await deps.orderQueryService.getOrderLines(event.tenantId, orderId);
    const orderWithLines = { ...order, lines };
    const channel = await deps.commerceIntegrationQueryService.getCommerceIntegrationById(event.tenantId, order.channelId);
    const externalIdMaps = await loadOrderExternalIdMaps(
        deps.externalIntegerIdMappingQueryService,
        event.tenantId,
        [orderWithLines],
    );
    const ceOrder = mapCompatV2Order(orderWithLines, channel, externalIdMaps);
    return JSON.stringify({ Content: [ceOrder] });
}

/**
 * @param {object} deps
 * @param {import('../../orders/public/order-query-service.js').DefaultOrderQueryService} deps.orderQueryService
 * @param {import('../../commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} deps.externalIntegerIdMappingQueryService
 */
export function createCompatV2WebhookBodyBuilder(deps) {
    return (event) => buildCompatV2WebhookBody(deps, event);
}
