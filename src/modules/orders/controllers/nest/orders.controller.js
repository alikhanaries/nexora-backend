import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  createOrderBodySchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
} from '../../views/order.schemas.js';
import { toOrderDetailResponse, toOrderResponse } from '../../views/order.mapper.js';
import { mapCustomerInput } from '../../views/order-request.mapper.js';
import {
  cancelOrderBodySchema,
  toCancellationDetailResponse,
} from '../../../cancellations/public/index.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { ORDER_ROUTES } from '../../routes/order.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Idempotency orchestration stays here (HTTP adaptation); request mapping is in views/.
 */
@Controller()
class OrdersController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.orders.useCases;
    this.cancellationUseCases = coreServices.cancellations.useCases;
  }

  @Post(ORDER_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body, @Headers('idempotency-key') idempotencyKeyHeader) {
    const parsed = parseOrThrow(createOrderBodySchema, body, 'create order');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const outcome = await this.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: 'POST /api/v1/orders',
        idempotencyKey,
      },
      fingerprintRequest(parsed),
      async (tx) => {
        const { order } = await this.useCases.createOrder.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          channelId: parsed.channelId,
          currency: parsed.currency,
          lines: parsed.lines.map((line) => ({
            productId: line.productId,
            stockLocationId: line.stockLocationId,
            quantity: line.quantity,
            ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
          })),
          ...(parsed.customer === undefined ? {} : { customer: mapCustomerInput(parsed.customer) }),
          ...(parsed.externalOrderReference === undefined
            ? {}
            : { externalOrderReference: parsed.externalOrderReference }),
          ...(parsed.discountMinor === undefined ? {} : { discountMinor: parsed.discountMinor }),
          ...(parsed.taxMinor === undefined ? {} : { taxMinor: parsed.taxMinor }),
          ...(parsed.shippingMinor === undefined ? {} : { shippingMinor: parsed.shippingMinor }),
          transaction: tx,
        });
        return {
          success: true,
          data: toOrderDetailResponse(order),
        };
      },
      (responseBody) => ({ statusCode: 201, body: responseBody }),
      { useTransaction: true },
    );
    return outcome.value;
  }

  @Get(ORDER_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listOrdersQuerySchema, query, 'list orders');
    const actor = requireActorContext();
    const page = await this.useCases.listOrders.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
      ...(parsed.channelId === undefined ? {} : { channelId: parsed.channelId }),
      ...(parsed.externalOrderReference === undefined
        ? {}
        : { externalOrderReference: parsed.externalOrderReference }),
      ...(parsed.orderNumber === undefined ? {} : { orderNumber: parsed.orderNumber }),
      ...(parsed.createdAfter === undefined ? {} : { createdAfter: new Date(parsed.createdAfter) }),
      ...(parsed.createdBefore === undefined ? {} : { createdBefore: new Date(parsed.createdBefore) }),
      ...(parsed.updatedAfter === undefined ? {} : { updatedAfter: new Date(parsed.updatedAfter) }),
      ...(parsed.updatedBefore === undefined ? {} : { updatedBefore: new Date(parsed.updatedBefore) }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toOrderResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

  @Get(ORDER_ROUTES.getById.path)
  async getById(@Param() params) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const actor = requireActorContext();
    const { order } = await this.useCases.getOrder.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      orderId,
    });
    return { success: true, data: toOrderDetailResponse(order) };
  }

  @Post(ORDER_ROUTES.confirm.path)
  @HttpCode(200)
  async confirm(@Param() params) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { order } = await this.useCases.confirmOrder.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      orderId,
    });
    return { success: true, data: toOrderDetailResponse(order) };
  }

  /** Cancel all or part of an order (`orders.cancel`); creates a cancellation via the cancellations module. */
  @Post(ORDER_ROUTES.cancel.path)
  @HttpCode(201)
  async cancel(@Param() params, @Body() body) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const parsed = parseOrThrow(cancelOrderBodySchema, body ?? {}, 'cancel order');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { cancellation } = await this.cancellationUseCases.createCancellation.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      orderId,
      permission: 'orders.cancel',
      ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
      ...(parsed.lines === undefined ? {} : { lines: parsed.lines }),
    });
    return { success: true, data: toCancellationDetailResponse(cancellation) };
  }
}
export { OrdersController };
