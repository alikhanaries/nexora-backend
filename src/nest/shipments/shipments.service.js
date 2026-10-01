import { Inject, Injectable } from '@nestjs/common';
import {
  toShipmentDetailResponse,
  toShipmentResponse,
} from '../../modules/shipments/presentation/shipment.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { actorFingerprint } from '../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../shared/idempotency/index.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class ShipmentsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.shipments.useCases;
  }

  /**
   * @param {string} orderId
   * @param {import('zod').infer<typeof import('../../modules/shipments/presentation/shipment.schemas.js').createShipmentBodySchema>} body
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
    const outcome = await this.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: 'POST /api/v1/orders/:orderId/shipments',
        idempotencyKey,
      },
      requestFingerprint,
      async (tx) => {
        const { shipment } = await this.useCases.createShipment.execute({
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
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/shipments/presentation/shipment.schemas.js').listShipmentsQuerySchema>} query
   */
  async listShipments(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listShipments.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.orderId === undefined ? {} : { orderId: query.orderId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.trackingNumber === undefined ? {} : { trackingNumber: query.trackingNumber }),
    });
    return {
      items: page.items.map(toShipmentResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async getShipment(shipmentId) {
    const actor = requireActorContext();
    const { shipment } = await this.useCases.getShipment.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return toShipmentDetailResponse(shipment);
  }

  /**
   * @param {string} shipmentId
   * @param {import('zod').infer<typeof import('../../modules/shipments/presentation/shipment.schemas.js').shipShipmentBodySchema>} body
   */
  async shipShipment(shipmentId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.useCases.shipShipment.execute({
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
  }

  async deliverShipment(shipmentId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.useCases.deliverShipment.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return toShipmentDetailResponse(shipment);
  }

  async cancelShipment(shipmentId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.useCases.cancelShipment.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return toShipmentDetailResponse(shipment);
  }
}
