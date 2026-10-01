import { Inject, Injectable } from '@nestjs/common';
import { PriceStatus } from '../../modules/pricing/domain/price-status.js';
import { toPriceResponse } from '../../modules/pricing/presentation/price.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class PricingService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.pricing.useCases;
  }

  async listPrices(query) {
    const actor = requireActorContext();
    const page = await this.useCases.listPrices.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.productId === undefined ? {} : { productId: query.productId }),
      ...(query.channelId === undefined ? {} : { channelId: query.channelId }),
      ...(query.currency === undefined ? {} : { currency: query.currency }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: page.items.map(toPriceResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async createPrice(body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { price } = await this.useCases.createPrice.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId: body.productId,
      currency: body.currency,
      amountMinor: body.amountMinor,
      ...(body.channelId === undefined ? {} : { channelId: body.channelId }),
      ...(body.validFrom === undefined ? {} : { validFrom: new Date(body.validFrom) }),
      ...(body.validTo === undefined
        ? {}
        : { validTo: body.validTo === null ? null : new Date(body.validTo) }),
    });
    return toPriceResponse(price);
  }

  async getPrice(priceId) {
    const actor = requireActorContext();
    const { price } = await this.useCases.getPrice.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      priceId,
    });
    return toPriceResponse(price);
  }

  async patchPrice(priceId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    let price;
    if (body.status === PriceStatus.INACTIVE) {
      ({ price } = await this.useCases.deactivatePrice.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        priceId,
      }));
    } else {
      ({ price } = await this.useCases.updatePrice.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        priceId,
        ...(body.amountMinor === undefined ? {} : { amountMinor: body.amountMinor }),
        ...(body.channelId === undefined ? {} : { channelId: body.channelId }),
        ...(body.validFrom === undefined ? {} : { validFrom: new Date(body.validFrom) }),
        ...(body.validTo === undefined
          ? {}
          : { validTo: body.validTo === null ? null : new Date(body.validTo) }),
      }));
    }
    return toPriceResponse(price);
  }
}
