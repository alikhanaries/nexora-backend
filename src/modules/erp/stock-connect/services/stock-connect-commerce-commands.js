import { toOrderDetailResponse, toOrderResponse } from '../../../orders/views/order.mapper.js';
import { toCancellationDetailResponse } from '../../../cancellations/views/cancellation.mapper.js';
import { toShipmentDetailResponse } from '../../../shipments/views/shipment.mapper.js';
import { toCommerceIntegrationResponse } from '../../../commerce-integrations/views/commerce-integration.mapper.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';

/**
 * Order / shipment / channel / cancellation use-case calls shared by Stock Connect v2 HTTP adapters.
 * Calls module use cases directly (no Nest service classes).
 *
 * @param {object} coreServices
 */
export function createStockConnectCommerceCommands(coreServices) {
  const orders = () => coreServices.orders.useCases;
  const shipments = () => coreServices.shipments.useCases;
  const cancellations = () => coreServices.cancellations.useCases;
  const channels = () => coreServices.channelRouteDeps;

  return {
    async listOrders(query) {
      const actor = requireActorContext();
      const page = await orders().listOrders.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.channelId === undefined ? {} : { channelId: query.channelId }),
        ...(query.externalOrderReference === undefined
          ? {}
          : { externalOrderReference: query.externalOrderReference }),
        ...(query.orderNumber === undefined ? {} : { orderNumber: query.orderNumber }),
        ...(query.createdAfter === undefined ? {} : { createdAfter: new Date(query.createdAfter) }),
        ...(query.createdBefore === undefined ? {} : { createdBefore: new Date(query.createdBefore) }),
        ...(query.updatedAfter === undefined ? {} : { updatedAfter: new Date(query.updatedAfter) }),
        ...(query.updatedBefore === undefined ? {} : { updatedBefore: new Date(query.updatedBefore) }),
      });
      return {
        items: page.items.map(toOrderResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      };
    },

    async getOrder(orderId) {
      const actor = requireActorContext();
      const { order } = await orders().getOrder.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        orderId,
      });
      return toOrderDetailResponse(order);
    },

    /**
     * @param {string} orderId
     * @param {{ reason?: string | null, lines?: unknown[] }} body
     */
    async cancelOrder(orderId, body) {
      const actor = requireActorContext();
      const { actorId, actorKind } = commerceActorFields(actor);
      const { cancellation } = await cancellations().createCancellation.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        orderId,
        permission: 'orders.cancel',
        ...(body.reason === undefined ? {} : { reason: body.reason }),
        ...(body.lines === undefined ? {} : { lines: body.lines }),
      });
      return toCancellationDetailResponse(cancellation);
    },

    /**
     * @param {string} orderId
     * @param {{ lines: unknown[], carrier?: string, service?: string, trackingNumber?: string }} body
     * @param {string | string[] | undefined} idempotencyKeyHeader
     */
    async createShipment(orderId, body, idempotencyKeyHeader) {
      const actor = requireActorContext();
      const { actorId, actorKind } = commerceActorFields(actor);
      const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
      const requestFingerprint = fingerprintRequest({
        orderId,
        ...body,
      });
      const outcome = await shipments().idempotency.execute(
        {
          tenantId: actor.tenantId,
          principalFingerprint: actorFingerprint(actor),
          routeId: 'POST /api/v1/orders/:orderId/shipments',
          idempotencyKey,
        },
        requestFingerprint,
        async (tx) => {
          const { shipment } = await shipments().createShipment.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            orderId,
            lines: body.lines,
            ...(body.carrier === undefined ? {} : { carrier: body.carrier }),
            ...(body.service === undefined ? {} : { service: body.service }),
            ...(body.trackingNumber === undefined ? {} : { trackingNumber: body.trackingNumber }),
            transaction: tx,
          });
          return {
            success: true,
            data: toShipmentDetailResponse(shipment),
          };
        },
        (responseBody) => ({ statusCode: 201, body: responseBody }),
        { useTransaction: true },
      );
      return outcome.value;
    },

    async getShipment(shipmentId) {
      const actor = requireActorContext();
      const { shipment } = await shipments().getShipment.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        shipmentId,
      });
      return toShipmentDetailResponse(shipment);
    },

    /**
     * @param {string} shipmentId
     * @param {{ carrier?: string, service?: string, trackingNumber?: string }} body
     */
    async shipShipment(shipmentId, body) {
      const actor = requireActorContext();
      const { actorId, actorKind } = commerceActorFields(actor);
      const { shipment } = await shipments().shipShipment.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        shipmentId,
        ...(body.carrier === undefined ? {} : { carrier: body.carrier }),
        ...(body.service === undefined ? {} : { service: body.service }),
        ...(body.trackingNumber === undefined ? {} : { trackingNumber: body.trackingNumber }),
      });
      return toShipmentDetailResponse(shipment);
    },

    async listCommerceIntegrations(query = {}) {
      const actor = requireActorContext();
      const { channels: items } = await channels().listCommerceIntegrations.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.marketplaceId === undefined ? {} : { marketplaceId: query.marketplaceId }),
      });
      return items.map(toCommerceIntegrationResponse);
    },
  };
}
