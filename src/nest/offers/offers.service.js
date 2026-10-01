import { Inject, Injectable } from '@nestjs/common';
import { OfferStatus } from '../../modules/offers/domain/offer-status.js';
import { toOfferResponse } from '../../modules/offers/presentation/offer.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class OffersService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.offers.useCases;
  }

  async listOffers(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listOffers.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.productId === undefined ? {} : { productId: query.productId }),
      ...(query.channelId === undefined ? {} : { channelId: query.channelId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: page.items.map(toOfferResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async createOffer(body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { offer } = await this.useCases.createOffer.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId: body.productId,
      channelId: body.channelId,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
      ...(body.priceReference === undefined ? {} : { priceReference: body.priceReference }),
    });
    return toOfferResponse(offer);
  }

  async getOffer(offerId) {
    const actor = requireActorContext();
    const { offer } = await this.useCases.getOffer.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      offerId,
    });
    return toOfferResponse(offer);
  }

  async patchOffer(offerId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    let offer;
    if (
      body.externalReference !== undefined ||
      body.priceReference !== undefined ||
      body.listingStatus !== undefined
    ) {
      ({ offer } = await this.useCases.updateOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        offerId,
        ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
        ...(body.priceReference === undefined ? {} : { priceReference: body.priceReference }),
        ...(body.listingStatus === undefined ? {} : { listingStatus: body.listingStatus }),
      }));
    } else {
      ({ offer } = await this.useCases.getOffer.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        offerId,
      }));
    }
    if (body.status !== undefined && body.status !== offer.status) {
      if (body.status === OfferStatus.ACTIVE) {
        ({ offer } = await this.useCases.activateOffer.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          offerId,
        }));
      } else if (body.status === OfferStatus.INACTIVE) {
        ({ offer } = await this.useCases.deactivateOffer.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          offerId,
        }));
      } else {
        ({ offer } = await this.useCases.suspendOffer.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          offerId,
        }));
      }
    }
    return toOfferResponse(offer);
  }

  async activateOffer(offerId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { offer } = await this.useCases.activateOffer.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      offerId,
      ...(body.resolvePricing === undefined ? {} : { resolvePricing: body.resolvePricing }),
      ...(body.currency === undefined ? {} : { currency: body.currency }),
    });
    return toOfferResponse(offer);
  }
}
