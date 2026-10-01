import { Inject, Injectable } from '@nestjs/common';
import { toReturnResponse } from '../../modules/returns/presentation/return.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { actorFingerprint } from '../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../shared/idempotency/index.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class ReturnsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.returns.useCases;
  }

  /**
   * @param {string} orderId
   * @param {import('zod').infer<typeof import('../../modules/returns/presentation/return.schemas.js').createReturnBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async createReturn(orderId, body, idempotencyKeyHeader) {
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
          lines: body.lines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
            ...(line.reason === undefined ? {} : { reason: line.reason }),
          })),
          ...(body.shipmentId === undefined ? {} : { shipmentId: body.shipmentId }),
          ...(body.reason === undefined ? {} : { reason: body.reason }),
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

  /**
   * @param {import('zod').infer<typeof import('../../modules/returns/presentation/return.schemas.js').listReturnsQuerySchema>} query
   */
  async listReturns(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listReturns.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.orderId === undefined ? {} : { orderId: query.orderId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: page.items.map(toReturnResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async getReturn(returnId) {
    const actor = requireActorContext();
    const { return: returnDetail } = await this.useCases.getReturn.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      returnId,
    });
    return toReturnResponse(returnDetail);
  }

  async approveReturn(returnId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { return: returnDetail } = await this.useCases.approveReturn.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      returnId,
    });
    return toReturnResponse(returnDetail);
  }

  async receiveReturn(returnId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { return: returnDetail } = await this.useCases.receiveReturn.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      returnId,
    });
    return toReturnResponse(returnDetail);
  }

  async completeReturn(returnId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { return: returnDetail } = await this.useCases.completeReturn.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      returnId,
    });
    return toReturnResponse(returnDetail);
  }

  async rejectReturn(returnId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { return: returnDetail } = await this.useCases.rejectReturn.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      returnId,
    });
    return toReturnResponse(returnDetail);
  }

  async cancelReturn(returnId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { return: returnDetail } = await this.useCases.cancelReturn.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      returnId,
    });
    return toReturnResponse(returnDetail);
  }
}
