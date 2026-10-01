import { Inject, Injectable } from '@nestjs/common';
import { MarketplaceStatus } from '../../modules/marketplaces/domain/marketplace-status.js';
import { toMarketplaceResponse } from '../../modules/marketplaces/presentation/marketplace.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class MarketplacesService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.marketplaces.useCases;
  }

  async listMarketplaces(query) {
    const actor = requireActorContext();
    const { marketplaces } = await this.useCases.listMarketplaces.execute({
      actorPermissions: actor.permissions,
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return marketplaces.map(toMarketplaceResponse);
  }

  async createMarketplace(body) {
    const actor = requireActorContext();
    const { marketplace } = await this.useCases.createMarketplace.execute({
      actorPermissions: actor.permissions,
      key: body.key,
      name: body.name,
    });
    return toMarketplaceResponse(marketplace);
  }

  async getMarketplace(marketplaceId) {
    const actor = requireActorContext();
    const { marketplace } = await this.useCases.getMarketplace.execute({
      actorPermissions: actor.permissions,
      marketplaceId,
    });
    return toMarketplaceResponse(marketplace);
  }

  async patchMarketplace(marketplaceId, body) {
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.tenantId;
    let marketplace;
    if (body.name !== undefined) {
      ({ marketplace } = await this.useCases.updateMarketplace.execute({
        actorPermissions: actor.permissions,
        marketplaceId,
        name: body.name,
      }));
    } else {
      ({ marketplace } = await this.useCases.getMarketplace.execute({
        actorPermissions: actor.permissions,
        marketplaceId,
      }));
    }
    if (body.status !== undefined && body.status !== marketplace.status) {
      if (body.status === MarketplaceStatus.ACTIVE) {
        ({ marketplace } = await this.useCases.activateMarketplace.execute({
          actorPermissions: actor.permissions,
          actorId,
          actorTenantId: actor.tenantId,
          marketplaceId,
        }));
      } else {
        ({ marketplace } = await this.useCases.deactivateMarketplace.execute({
          actorPermissions: actor.permissions,
          actorId,
          actorTenantId: actor.tenantId,
          marketplaceId,
        }));
      }
    }
    return toMarketplaceResponse(marketplace);
  }
}
