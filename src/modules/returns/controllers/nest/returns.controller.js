import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  createReturnBodySchema,
  listReturnsQuerySchema,
  orderIdParamsSchema,
  returnIdParamsSchema,
} from '../../views/return.schemas.js';
import { toReturnResponse } from '../../views/return.mapper.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { RETURN_ROUTES } from '../../routes/return.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Idempotency orchestration stays here (HTTP adaptation).
 */
export @Controller()
class ReturnsController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.returns.useCases;
  }

  @Post(RETURN_ROUTES.createForOrder.path)
  @HttpCode(201)
  async createForOrder(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKeyHeader,
  ) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
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
        routeId: 'POST /api/v1/orders/:orderId/returns',
        idempotencyKey,
      },
      requestFingerprint,
      async (tx) => {
        const { return: returnDetail } = await this.useCases.createReturn.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          orderId,
          lines: parsed.lines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
            ...(line.reason === undefined ? {} : { reason: line.reason }),
          })),
          ...(parsed.shipmentId === undefined ? {} : { shipmentId: parsed.shipmentId }),
          ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
          transaction: tx,
        });
        return {
          success: true,
          data: toReturnResponse(returnDetail),
        };
      },
      (responseBody) => ({ statusCode: 201, body: responseBody }),
      { useTransaction: true },
    );
    return outcome.value;
  }

  @Get(RETURN_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listReturnsQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const page = await this.useCases.listReturns.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.orderId === undefined ? {} : { orderId: parsed.orderId }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toReturnResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

  @Get(RETURN_ROUTES.getById.path)
  async getById(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const actor = requireActorContext();
    const { return: returnDetail } = await this.useCases.getReturn.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      returnId,
    });
    return { success: true, data: toReturnResponse(returnDetail) };
  }

  @Post(RETURN_ROUTES.approve.path)
  @HttpCode(200)
  async approve(@Param() params) {
    return this.transition('approveReturn', params);
  }

  @Post(RETURN_ROUTES.receive.path)
  @HttpCode(200)
  async receive(@Param() params) {
    return this.transition('receiveReturn', params);
  }

  @Post(RETURN_ROUTES.complete.path)
  @HttpCode(200)
  async complete(@Param() params) {
    return this.transition('completeReturn', params);
  }

  @Post(RETURN_ROUTES.reject.path)
  @HttpCode(200)
  async reject(@Param() params) {
    return this.transition('rejectReturn', params);
  }

  @Post(RETURN_ROUTES.cancel.path)
  @HttpCode(200)
  async cancel(@Param() params) {
    return this.transition('cancelReturn', params);
  }

  /**
   * Shared HTTP adaptation for return lifecycle transitions (no business rules).
   * @param {'approveReturn' | 'receiveReturn' | 'completeReturn' | 'rejectReturn' | 'cancelReturn'} useCaseName
   */
  async transition(useCaseName, params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { return: returnDetail } = await this.useCases[useCaseName].execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      returnId,
    });
    return { success: true, data: toReturnResponse(returnDetail) };
  }
}
