import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  activateOfferBodySchema,
  createOfferBodySchema,
  listOffersQuerySchema,
  offerIdParamsSchema,
  updateOfferBodySchema,
} from '../../views/offer.schemas.js';
import { toOfferResponse } from '../../views/offer.mapper.js';
import { OfferStatus } from '../../models/offer-status.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { OFFER_ROUTES } from '../../routes/offer.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 */
export @Controller()
class OffersController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.offers.useCases;
  }

  @Get(OFFER_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listOffersQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const page = await this.useCases.listOffers.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.productId === undefined ? {} : { productId: parsed.productId }),
      ...(parsed.channelId === undefined ? {} : { channelId: parsed.channelId }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toOfferResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

  @Post(OFFER_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createOfferBodySchema, body, 'create offer');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { offer } = await this.useCases.createOffer.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId: parsed.productId,
      channelId: parsed.channelId,
      ...(parsed.externalReference === undefined ? {} : { externalReference: parsed.externalReference }),
      ...(parsed.priceReference === undefined ? {} : { priceReference: parsed.priceReference }),
    });
    return { success: true, data: toOfferResponse(offer) };
  }

  @Get(OFFER_ROUTES.getById.path)
  async getById(@Param() params) {
    const { offerId } = parseOrThrow(offerIdParamsSchema, params, 'offer params');
    const actor = requireActorContext();
    const { offer } = await this.useCases.getOffer.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      offerId,
    });
    return { success: true, data: toOfferResponse(offer) };
  }

  @Patch(OFFER_ROUTES.patch.path)
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { offerId } = parseOrThrow(offerIdParamsSchema, params, 'offer params');
    const parsed = parseOrThrow(updateOfferBodySchema, body, 'update offer');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    let offer;
    if (
      parsed.externalReference !== undefined ||
      parsed.priceReference !== undefined ||
      parsed.listingStatus !== undefined
    ) {
      ({ offer } = await this.useCases.updateOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        offerId,
        ...(parsed.externalReference === undefined ? {} : { externalReference: parsed.externalReference }),
        ...(parsed.priceReference === undefined ? {} : { priceReference: parsed.priceReference }),
        ...(parsed.listingStatus === undefined ? {} : { listingStatus: parsed.listingStatus }),
      }));
    } else {
      ({ offer } = await this.useCases.getOffer.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        offerId,
      }));
    }
    if (parsed.status !== undefined && parsed.status !== offer.status) {
      const transition = {
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        offerId,
      };
      if (parsed.status === OfferStatus.ACTIVE) {
        ({ offer } = await this.useCases.activateOffer.execute(transition));
      } else if (parsed.status === OfferStatus.INACTIVE) {
        ({ offer } = await this.useCases.deactivateOffer.execute(transition));
      } else {
        ({ offer } = await this.useCases.suspendOffer.execute(transition));
      }
    }
    return { success: true, data: toOfferResponse(offer) };
  }

  @Post(OFFER_ROUTES.activate.path)
  @HttpCode(200)
  async activate(@Param() params, @Body() body) {
    const { offerId } = parseOrThrow(offerIdParamsSchema, params, 'offer params');
    const parsed = parseOrThrow(activateOfferBodySchema, body ?? {}, 'activate offer');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { offer } = await this.useCases.activateOffer.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      offerId,
      ...(parsed.resolvePricing === undefined ? {} : { resolvePricing: parsed.resolvePricing }),
      ...(parsed.currency === undefined ? {} : { currency: parsed.currency }),
    });
    return { success: true, data: toOfferResponse(offer) };
  }
}
