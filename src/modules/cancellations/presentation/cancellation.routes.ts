import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import type { CreateCancellation } from '../application/create-cancellation.js';
import type { GetCancellation } from '../application/get-cancellation.js';
import type { ListCancellations } from '../application/list-cancellations.js';
import { toCancellationDetailResponse, toCancellationResponse } from './cancellation.mapper.js';
import {
  cancelOrderBodySchema,
  cancellationIdParamsSchema,
  cancellationListSuccessResponseSchema,
  cancellationSuccessResponseSchema,
  createCancellationBodySchema,
  listCancellationsQuerySchema,
  orderIdParamsSchema,
} from './cancellation.schemas.js';

export interface CancellationRoutesDependencies {
  readonly createCancellation: CreateCancellation;
  readonly getCancellation: GetCancellation;
  readonly listCancellations: ListCancellations;
}

const cancellationRoutes: FastifyPluginAsync<CancellationRoutesDependencies> = async (
  app,
  deps,
) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/cancellations',
    {
      schema: {
        tags: ['Cancellations'],
        summary: 'List cancellations',
        querystring: listCancellationsQuerySchema,
        response: {
          200: cancellationListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const page = await deps.listCancellations.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
        ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
        ...(request.query.orderId === undefined ? {} : { orderId: request.query.orderId }),
        ...(request.query.status === undefined ? {} : { status: request.query.status }),
      });

      return {
        success: true as const,
        data: {
          items: page.items.map(toCancellationResponse),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        },
      };
    },
  );

  typed.post(
    '/api/v1/cancellations',
    {
      schema: {
        tags: ['Cancellations'],
        summary: 'Create a cancellation for an order',
        body: createCancellationBodySchema,
        response: {
          201: cancellationSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      const { cancellation } = await deps.createCancellation.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        orderId: request.body.orderId,
        permission: 'cancellations.create',
        ...(request.body.reason === undefined ? {} : { reason: request.body.reason }),
        ...(request.body.lines === undefined ? {} : { lines: request.body.lines }),
      });

      void reply.status(201);
      return {
        success: true as const,
        data: toCancellationDetailResponse(cancellation),
      };
    },
  );

  typed.get(
    '/api/v1/cancellations/:cancellationId',
    {
      schema: {
        tags: ['Cancellations'],
        summary: 'Get a cancellation by id',
        params: cancellationIdParamsSchema,
        response: {
          200: cancellationSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { cancellation } = await deps.getCancellation.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        cancellationId: request.params.cancellationId,
      });

      return {
        success: true as const,
        data: toCancellationDetailResponse(cancellation),
      };
    },
  );

  typed.post(
    '/api/v1/orders/:orderId/cancel',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Cancel all or part of an order',
        params: orderIdParamsSchema,
        body: cancelOrderBodySchema,
        response: {
          201: cancellationSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      const { cancellation } = await deps.createCancellation.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        orderId: request.params.orderId,
        permission: 'orders.cancel',
        ...(request.body.reason === undefined ? {} : { reason: request.body.reason }),
        ...(request.body.lines === undefined ? {} : { lines: request.body.lines }),
      });

      void reply.status(201);
      return {
        success: true as const,
        data: toCancellationDetailResponse(cancellation),
      };
    },
  );

  await Promise.resolve();
};

export default cancellationRoutes;
