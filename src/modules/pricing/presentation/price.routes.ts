import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { PriceStatus } from '../domain/price-status.js';
import type { CreatePrice } from '../application/create-price.js';
import type { DeactivatePrice } from '../application/deactivate-price.js';
import type { GetPrice } from '../application/get-price.js';
import type { ListPrices } from '../application/list-prices.js';
import type { UpdatePrice } from '../application/update-price.js';
import { toPriceResponse } from './price.mapper.js';
import {
  createPriceBodySchema,
  listPricesQuerySchema,
  priceIdParamsSchema,
  priceListSuccessResponseSchema,
  priceSuccessResponseSchema,
  updatePriceBodySchema,
} from './price.schemas.js';

export interface PriceRoutesDependencies {
  readonly createPrice: CreatePrice;
  readonly getPrice: GetPrice;
  readonly listPrices: ListPrices;
  readonly updatePrice: UpdatePrice;
  readonly deactivatePrice: DeactivatePrice;
}

const priceRoutes: FastifyPluginAsync<PriceRoutesDependencies> = async (app, deps) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/prices',
    {
      schema: {
        tags: ['Pricing'],
        summary: 'List product prices',
        querystring: listPricesQuerySchema,
        response: {
          200: priceListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const page = await deps.listPrices.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
        ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
        ...(request.query.productId === undefined ? {} : { productId: request.query.productId }),
        ...(request.query.channelId === undefined ? {} : { channelId: request.query.channelId }),
        ...(request.query.currency === undefined ? {} : { currency: request.query.currency }),
        ...(request.query.status === undefined ? {} : { status: request.query.status }),
      });

      return {
        success: true as const,
        data: {
          items: page.items.map(toPriceResponse),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        },
      };
    },
  );

  typed.post(
    '/api/v1/prices',
    {
      schema: {
        tags: ['Pricing'],
        summary: 'Create a product price',
        body: createPriceBodySchema,
        response: {
          201: priceSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      const { price } = await deps.createPrice.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: request.body.productId,
        currency: request.body.currency,
        amountMinor: request.body.amountMinor,
        ...(request.body.channelId === undefined ? {} : { channelId: request.body.channelId }),
        ...(request.body.validFrom === undefined
          ? {}
          : { validFrom: new Date(request.body.validFrom) }),
        ...(request.body.validTo === undefined
          ? {}
          : { validTo: request.body.validTo === null ? null : new Date(request.body.validTo) }),
      });

      void reply.status(201);
      return {
        success: true as const,
        data: toPriceResponse(price),
      };
    },
  );

  typed.get(
    '/api/v1/prices/:priceId',
    {
      schema: {
        tags: ['Pricing'],
        summary: 'Get a price by id',
        params: priceIdParamsSchema,
        response: {
          200: priceSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { price } = await deps.getPrice.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        priceId: request.params.priceId,
      });

      return {
        success: true as const,
        data: toPriceResponse(price),
      };
    },
  );

  typed.patch(
    '/api/v1/prices/:priceId',
    {
      schema: {
        tags: ['Pricing'],
        summary: 'Update or deactivate a price',
        params: priceIdParamsSchema,
        body: updatePriceBodySchema,
        response: {
          200: priceSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      let price;

      if (request.body.status === PriceStatus.INACTIVE) {
        ({ price } = await deps.deactivatePrice.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          priceId: request.params.priceId,
        }));
      } else {
        ({ price } = await deps.updatePrice.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          priceId: request.params.priceId,
          ...(request.body.amountMinor === undefined
            ? {}
            : { amountMinor: request.body.amountMinor }),
          ...(request.body.channelId === undefined ? {} : { channelId: request.body.channelId }),
          ...(request.body.validFrom === undefined
            ? {}
            : { validFrom: new Date(request.body.validFrom) }),
          ...(request.body.validTo === undefined
            ? {}
            : { validTo: request.body.validTo === null ? null : new Date(request.body.validTo) }),
        }));
      }

      return {
        success: true as const,
        data: toPriceResponse(price),
      };
    },
  );

  await Promise.resolve();
};

export default priceRoutes;
