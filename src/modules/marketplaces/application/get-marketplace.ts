import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { Marketplace } from '../domain/marketplace.js';
import type { MarketplaceRepository } from '../domain/marketplace-repository.port.js';
import { requireMarketplaceRead } from './marketplace-permissions.js';

export interface GetMarketplaceInput {
  readonly actorPermissions: readonly string[];
  readonly marketplaceId: string;
}

export interface GetMarketplaceResult {
  readonly marketplace: Marketplace;
}

export interface GetMarketplaceDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: MarketplaceRepository;
  readonly queryable: Queryable;
}

export class GetMarketplace {
  constructor(private readonly deps: GetMarketplaceDependencies) {}

  async execute(input: GetMarketplaceInput): Promise<GetMarketplaceResult> {
    requireMarketplaceRead(this.deps.authorization, input.actorPermissions);

    const marketplace = await this.deps.repository.findById(
      this.deps.queryable,
      input.marketplaceId,
    );
    if (marketplace === null) {
      throw new NotFoundError('Marketplace was not found', { marketplaceId: input.marketplaceId });
    }

    return { marketplace };
  }
}
