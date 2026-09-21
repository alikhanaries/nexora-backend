import type { AuthorizationService } from '../../authorization/public/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { Marketplace } from '../domain/marketplace.js';
import type { MarketplaceStatus } from '../domain/marketplace-status.js';
import type { MarketplaceRepository } from '../domain/marketplace-repository.port.js';
import { requireMarketplaceRead } from './marketplace-permissions.js';

export interface ListMarketplacesInput {
  readonly actorPermissions: readonly string[];
  readonly status?: MarketplaceStatus;
}

export interface ListMarketplacesResult {
  readonly marketplaces: readonly Marketplace[];
}

export interface ListMarketplacesDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: MarketplaceRepository;
  readonly queryable: Queryable;
}

export class ListMarketplaces {
  constructor(private readonly deps: ListMarketplacesDependencies) {}

  async execute(input: ListMarketplacesInput): Promise<ListMarketplacesResult> {
    requireMarketplaceRead(this.deps.authorization, input.actorPermissions);

    const marketplaces = await this.deps.repository.list(this.deps.queryable, {
      ...(input.status === undefined ? {} : { status: input.status }),
    });

    return { marketplaces };
  }
}
