import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createMarketplaceBodySchema,
  listMarketplacesQuerySchema,
  marketplaceIdParamsSchema,
  updateMarketplaceBodySchema,
} from '../../views/marketplace.schemas.js';
import { toMarketplaceResponse } from '../../views/marketplace.mapper.js';
import { MarketplaceStatus } from '../../models/marketplace-status.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { MARKETPLACE_ROUTES } from '../../routes/marketplace.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 */
export @Controller()
class MarketplacesController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.marketplaces.useCases;
  }

  @Get(MARKETPLACE_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listMarketplacesQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const { marketplaces } = await this.useCases.listMarketplaces.execute({
      actorPermissions: actor.permissions,
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return { success: true, data: marketplaces.map(toMarketplaceResponse) };
  }

  @Post(MARKETPLACE_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createMarketplaceBodySchema, body, 'create marketplace');
    const actor = requireActorContext();
    const { marketplace } = await this.useCases.createMarketplace.execute({
      actorPermissions: actor.permissions,
      key: parsed.key,
      name: parsed.name,
    });
    return { success: true, data: toMarketplaceResponse(marketplace) };
  }

  @Get(MARKETPLACE_ROUTES.getById.path)
  async getById(@Param() params) {
    const { id } = parseOrThrow(marketplaceIdParamsSchema, params, 'marketplace params');
    const actor = requireActorContext();
    const { marketplace } = await this.useCases.getMarketplace.execute({
      actorPermissions: actor.permissions,
      marketplaceId: id,
    });
    return { success: true, data: toMarketplaceResponse(marketplace) };
  }

  @Patch(MARKETPLACE_ROUTES.patch.path)
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { id } = parseOrThrow(marketplaceIdParamsSchema, params, 'marketplace params');
    const parsed = parseOrThrow(updateMarketplaceBodySchema, body, 'update marketplace');
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.tenantId;
    let marketplace;
    if (parsed.name !== undefined) {
      ({ marketplace } = await this.useCases.updateMarketplace.execute({
        actorPermissions: actor.permissions,
        marketplaceId: id,
        name: parsed.name,
      }));
    } else {
      ({ marketplace } = await this.useCases.getMarketplace.execute({
        actorPermissions: actor.permissions,
        marketplaceId: id,
      }));
    }
    if (parsed.status !== undefined && parsed.status !== marketplace.status) {
      if (parsed.status === MarketplaceStatus.ACTIVE) {
        ({ marketplace } = await this.useCases.activateMarketplace.execute({
          actorPermissions: actor.permissions,
          actorId,
          actorTenantId: actor.tenantId,
          marketplaceId: id,
        }));
      } else {
        ({ marketplace } = await this.useCases.deactivateMarketplace.execute({
          actorPermissions: actor.permissions,
          actorId,
          actorTenantId: actor.tenantId,
          marketplaceId: id,
        }));
      }
    }
    return { success: true, data: toMarketplaceResponse(marketplace) };
  }
}
