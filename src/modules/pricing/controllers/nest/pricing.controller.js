import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createPriceBodySchema,
  listPricesQuerySchema,
  priceIdParamsSchema,
  updatePriceBodySchema,
} from '../../views/price.schemas.js';
import { toPriceResponse } from '../../views/price.mapper.js';
import { PriceStatus } from '../../models/price-status.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { commerceActorFields } from '../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { PRICE_ROUTES } from '../../routes/price.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Route family `/api/v1/prices` (PRICE_ROUTES); handlers call `CORE_SERVICES.pricing.useCases`.
 */
@Controller()
class PricingController {
/** Binds `CORE_SERVICES` price use cases for this HTTP adapter. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.pricing.useCases;
  }

/** HTTP handler: validates input, reads tenant actor, delegates to price use case `list`. */
  @Get(PRICE_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listPricesQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const page = await this.useCases.listPrices.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.productId === undefined ? {} : { productId: parsed.productId }),
      ...(parsed.channelId === undefined ? {} : { channelId: parsed.channelId }),
      ...(parsed.currency === undefined ? {} : { currency: parsed.currency }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toPriceResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to price use case `create`. */
  @Post(PRICE_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createPriceBodySchema, body, 'create price');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { price } = await this.useCases.createPrice.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId: parsed.productId,
      currency: parsed.currency,
      amountMinor: parsed.amountMinor,
      ...(parsed.channelId === undefined ? {} : { channelId: parsed.channelId }),
      ...(parsed.validFrom === undefined ? {} : { validFrom: new Date(parsed.validFrom) }),
      ...(parsed.validTo === undefined
        ? {}
        : { validTo: parsed.validTo === null ? null : new Date(parsed.validTo) }),
    });
    return { success: true, data: toPriceResponse(price) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to price use case `getById`. */
  @Get(PRICE_ROUTES.getById.path)
  async getById(@Param() params) {
    const { priceId } = parseOrThrow(priceIdParamsSchema, params, 'price params');
    const actor = requireActorContext();
    const { price } = await this.useCases.getPrice.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      priceId,
    });
    return { success: true, data: toPriceResponse(price) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to price use case `patch`. */
  @Patch(PRICE_ROUTES.patch.path)
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { priceId } = parseOrThrow(priceIdParamsSchema, params, 'price params');
    const parsed = parseOrThrow(updatePriceBodySchema, body, 'update price');
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    let price;
    if (parsed.status === PriceStatus.INACTIVE) {
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
        ...(parsed.amountMinor === undefined ? {} : { amountMinor: parsed.amountMinor }),
        ...(parsed.channelId === undefined ? {} : { channelId: parsed.channelId }),
        ...(parsed.validFrom === undefined ? {} : { validFrom: new Date(parsed.validFrom) }),
        ...(parsed.validTo === undefined
          ? {}
          : { validTo: parsed.validTo === null ? null : new Date(parsed.validTo) }),
      }));
    }
    return { success: true, data: toPriceResponse(price) };
  }
}
export { PricingController };
