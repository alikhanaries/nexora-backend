import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  createShipmentBodySchema,
  listShipmentsQuerySchema,
  orderIdParamsSchema,
  shipmentIdParamsSchema,
  shipShipmentBodySchema,
} from '../../views/shipment.schemas.js';
import { toShipmentDetailResponse, toShipmentResponse } from '../../views/shipment.mapper.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { SHIPMENT_ROUTES } from '../../routes/shipment.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Idempotency orchestration stays here (HTTP adaptation).
 * Routes under `/api/v1/shipments` and order-nested shipments (SHIPMENT_ROUTES); handlers call `CORE_SERVICES.shipments.useCases`.
 */
@Controller()
class ShipmentsController {
/** Binds `CORE_SERVICES` shipment use cases for this HTTP adapter. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.shipments.useCases;
  }

/** HTTP handler: validates input, reads tenant actor, delegates to shipment use case `createForOrder`. */
  @Post(SHIPMENT_ROUTES.createForOrder.path)
  @HttpCode(201)
  async createForOrder(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKeyHeader,
  ) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const requestFingerprint = fingerprintRequest({
      orderId,
      ...parsed,
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
          lines: parsed.lines,
          ...(parsed.carrier === undefined ? {} : { carrier: parsed.carrier }),
          ...(parsed.service === undefined ? {} : { service: parsed.service }),
          ...(parsed.trackingNumber === undefined ? {} : { trackingNumber: parsed.trackingNumber }),
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

/** HTTP handler: validates input, reads tenant actor, delegates to shipment use case `list`. */
  @Get(SHIPMENT_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listShipmentsQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const page = await this.useCases.listShipments.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.orderId === undefined ? {} : { orderId: parsed.orderId }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
      ...(parsed.trackingNumber === undefined ? {} : { trackingNumber: parsed.trackingNumber }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toShipmentResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to shipment use case `getById`. */
  @Get(SHIPMENT_ROUTES.getById.path)
  async getById(@Param() params) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const actor = requireActorContext();
    const { shipment } = await this.useCases.getShipment.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return { success: true, data: toShipmentDetailResponse(shipment) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to shipment use case `ship`. */
  @Post(SHIPMENT_ROUTES.ship.path)
  @HttpCode(200)
  async ship(@Param() params, @Body() body) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const parsed = parseOrThrow(shipShipmentBodySchema, body ?? {}, 'ship shipment');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.useCases.shipShipment.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      shipmentId,
      ...(parsed.carrier === undefined ? {} : { carrier: parsed.carrier }),
      ...(parsed.service === undefined ? {} : { service: parsed.service }),
      ...(parsed.trackingNumber === undefined ? {} : { trackingNumber: parsed.trackingNumber }),
    });
    return { success: true, data: toShipmentDetailResponse(shipment) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to shipment use case `deliver`. */
  @Post(SHIPMENT_ROUTES.deliver.path)
  @HttpCode(200)
  async deliver(@Param() params) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.useCases.deliverShipment.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return { success: true, data: toShipmentDetailResponse(shipment) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to shipment use case `cancel`. */
  @Post(SHIPMENT_ROUTES.cancel.path)
  @HttpCode(200)
  async cancel(@Param() params) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.useCases.cancelShipment.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return { success: true, data: toShipmentDetailResponse(shipment) };
  }
}
export { ShipmentsController };
