import type { Queryable } from '../../../shared/persistence/index.js';
import type { MarketplaceRepository } from '../domain/marketplace-repository.port.js';

export interface VerifyMarketplaceExistsInput {
  readonly marketplaceId: string;
}

export interface VerifyMarketplaceExistsResult {
  readonly exists: boolean;
}

export interface VerifyMarketplaceExistsDependencies {
  readonly repository: MarketplaceRepository;
  readonly queryable: Queryable;
}

export class VerifyMarketplaceExists {
  constructor(private readonly deps: VerifyMarketplaceExistsDependencies) {}

  async execute(input: VerifyMarketplaceExistsInput): Promise<VerifyMarketplaceExistsResult> {
    const marketplace = await this.deps.repository.findById(
      this.deps.queryable,
      input.marketplaceId,
    );
    return { exists: marketplace !== null };
  }
}
