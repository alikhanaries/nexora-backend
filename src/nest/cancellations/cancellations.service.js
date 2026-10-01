import { Inject, Injectable } from '@nestjs/common';
import {
  toCancellationDetailResponse,
  toCancellationResponse,
} from '../../modules/cancellations/presentation/cancellation.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { actorFingerprint } from '../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../shared/idempotency/index.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class CancellationsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.cancellations.useCases;
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/cancellations/presentation/cancellation.schemas.js').listCancellationsQuerySchema>} query
   */
  async listCancellations(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listCancellations.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.orderId === undefined ? {} : { orderId: query.orderId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: page.items.map(toCancellationResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  /**
   * @param {import('zod').infer<typeof import('../../modules/cancellations/presentation/cancellation.schemas.js').createCancellationBodySchema>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async createCancellation(body, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const outcome = await this.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: 'POST /api/v1/cancellations',
        idempotencyKey,
      },
      fingerprintRequest(body),
      async (tx) => {
        const { cancellation } = await this.useCases.createCancellation.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          orderId: body.orderId,
          permission: 'cancellations.create',
          ...(body.reason === undefined ? {} : { reason: body.reason }),
          ...(body.lines === undefined ? {} : { lines: body.lines }),
          transaction: tx,
        });
        return {
          success: true,
          data: toCancellationDetailResponse(cancellation),
        };
      },
      (responseBody) => ({ statusCode: 201, body: responseBody }),
      { useTransaction: true },
    );
    return outcome.value;
  }

  async getCancellation(cancellationId) {
    const actor = requireActorContext();
    const { cancellation } = await this.useCases.getCancellation.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      cancellationId,
    });
    return toCancellationDetailResponse(cancellation);
  }

  /**
   * @param {string} orderId
   * @param {import('zod').infer<typeof import('../../modules/cancellations/presentation/cancellation.schemas.js').cancelOrderBodySchema>} body
   */
  async cancelOrder(orderId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { cancellation } = await this.useCases.createCancellation.execute({
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
  }
}
