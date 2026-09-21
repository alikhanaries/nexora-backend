import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { OfferStatus } from '../domain/offer-status.js';
import type { ActivateOffer } from '../application/activate-offer.js';
import type { CreateOffer } from '../application/create-offer.js';
import type { DeactivateOffer } from '../application/deactivate-offer.js';
import type { GetOffer } from '../application/get-offer.js';
import type { ListOffers } from '../application/list-offers.js';
import type { SuspendOffer } from '../application/suspend-offer.js';
import type { UpdateOffer } from '../application/update-offer.js';
import { toOfferResponse } from './offer.mapper.js';
import {
  activateOfferBodySchema,
  createOfferBodySchema,
  listOffersQuerySchema,
  offerIdParamsSchema,
  offerListSuccessResponseSchema,
  offerSuccessResponseSchema,
  updateOfferBodySchema,
} from './offer.schemas.js';

export interface OfferRoutesDependencies {
  readonly createOffer: CreateOffer;
  readonly getOffer: GetOffer;
  readonly listOffers: ListOffers;
  readonly updateOffer: UpdateOffer;
  readonly activateOffer: ActivateOffer;
  readonly suspendOffer: SuspendOffer;
  readonly deactivateOffer: DeactivateOffer;
}

const offerRoutes: FastifyPluginAsync<OfferRoutesDependencies> = async (app, deps) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/offers',
    {
      schema: {
        tags: ['Offers'],
        summary: 'List channel offers',
        querystring: listOffersQuerySchema,
        response: {
          200: offerListSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const page = await deps.listOffers.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
        ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
        ...(request.query.productId === undefined ? {} : { productId: request.query.productId }),
        ...(request.query.channelId === undefined ? {} : { channelId: request.query.channelId }),
        ...(request.query.status === undefined ? {} : { status: request.query.status }),
      });

      return {
        success: true as const,
        data: {
          items: page.items.map(toOfferResponse),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        },
      };
    },
  );

  typed.post(
    '/api/v1/offers',
    {
      schema: {
        tags: ['Offers'],
        summary: 'Create a channel offer',
        body: createOfferBodySchema,
        response: {
          201: offerSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      const { offer } = await deps.createOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        productId: request.body.productId,
        channelId: request.body.channelId,
        ...(request.body.externalReference === undefined
          ? {}
          : { externalReference: request.body.externalReference }),
        ...(request.body.priceReference === undefined
          ? {}
          : { priceReference: request.body.priceReference }),
      });

      void reply.status(201);
      return {
        success: true as const,
        data: toOfferResponse(offer),
      };
    },
  );

  typed.get(
    '/api/v1/offers/:offerId',
    {
      schema: {
        tags: ['Offers'],
        summary: 'Get an offer by id',
        params: offerIdParamsSchema,
        response: {
          200: offerSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const { offer } = await deps.getOffer.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        offerId: request.params.offerId,
      });

      return {
        success: true as const,
        data: toOfferResponse(offer),
      };
    },
  );

  typed.patch(
    '/api/v1/offers/:offerId',
    {
      schema: {
        tags: ['Offers'],
        summary: 'Update an offer or change lifecycle status',
        params: offerIdParamsSchema,
        body: updateOfferBodySchema,
        response: {
          200: offerSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      let offer;

      if (
        request.body.externalReference !== undefined ||
        request.body.priceReference !== undefined ||
        request.body.listingStatus !== undefined
      ) {
        ({ offer } = await deps.updateOffer.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          offerId: request.params.offerId,
          ...(request.body.externalReference === undefined
            ? {}
            : { externalReference: request.body.externalReference }),
          ...(request.body.priceReference === undefined
            ? {}
            : { priceReference: request.body.priceReference }),
          ...(request.body.listingStatus === undefined
            ? {}
            : { listingStatus: request.body.listingStatus }),
        }));
      } else {
        ({ offer } = await deps.getOffer.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          offerId: request.params.offerId,
        }));
      }

      if (request.body.status !== undefined && request.body.status !== offer.status) {
        if (request.body.status === OfferStatus.ACTIVE) {
          ({ offer } = await deps.activateOffer.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            offerId: request.params.offerId,
          }));
        } else if (request.body.status === OfferStatus.INACTIVE) {
          ({ offer } = await deps.deactivateOffer.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            offerId: request.params.offerId,
          }));
        } else {
          ({ offer } = await deps.suspendOffer.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            offerId: request.params.offerId,
          }));
        }
      }

      return {
        success: true as const,
        data: toOfferResponse(offer),
      };
    },
  );

  typed.post(
    '/api/v1/offers/:offerId/activate',
    {
      schema: {
        tags: ['Offers'],
        summary: 'Activate a draft or suspended offer',
        params: offerIdParamsSchema,
        body: activateOfferBodySchema,
        response: {
          200: offerSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
      const actorKind = actor.userId !== undefined ? ('user' as const) : ('api-key' as const);

      const { offer } = await deps.activateOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        offerId: request.params.offerId,
        ...(request.body.resolvePricing === undefined
          ? {}
          : { resolvePricing: request.body.resolvePricing }),
        ...(request.body.currency === undefined ? {} : { currency: request.body.currency }),
      });

      return {
        success: true as const,
        data: toOfferResponse(offer),
      };
    },
  );

  await Promise.resolve();
};

export default offerRoutes;
