import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  cancellationIdParamsSchema,
  createCancellationBodySchema,
  listCancellationsQuerySchema,
} from '../../views/cancellation.schemas.js';
import {
  toCancellationDetailResponse,
  toCancellationResponse,
} from '../../views/cancellation.mapper.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { CANCELLATION_ROUTES } from '../../routes/cancellation.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Idempotency orchestration stays here (HTTP adaptation).
 * Order cancel (`POST /api/v1/orders/:orderId/cancel`) lives on OrdersController.
 */
@Controller()
class CancellationsController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.cancellations.useCases;
  }

  @Get(CANCELLATION_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listCancellationsQuerySchema, query, 'list cancellations');
    const actor = requireActorContext();
    const page = await this.useCases.listCancellations.execute({
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
        items: page.items.map(toCancellationResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

  @Post(CANCELLATION_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body, @Headers('idempotency-key') idempotencyKeyHeader) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
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
      fingerprintRequest(parsed),
      async (tx) => {
        const { cancellation } = await this.useCases.createCancellation.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          orderId: parsed.orderId,
          permission: 'cancellations.create',
          ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
          ...(parsed.lines === undefined ? {} : { lines: parsed.lines }),
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

  @Get(CANCELLATION_ROUTES.getById.path)
  async getById(@Param() params) {
    const { cancellationId } = parseOrThrow(
      cancellationIdParamsSchema,
      params,
      'cancellation params',
    );
    const actor = requireActorContext();
    const { cancellation } = await this.useCases.getCancellation.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      cancellationId,
    });
    return { success: true, data: toCancellationDetailResponse(cancellation) };
  }
}
export { CancellationsController };
