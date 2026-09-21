import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { Marketplace } from '../domain/marketplace.js';
import type { MarketplaceRepository } from '../domain/marketplace-repository.port.js';
import { marketplaceUpdatedEvent } from './marketplace-events.js';
import { requireMarketplaceManage } from './marketplace-permissions.js';

export interface UpdateMarketplaceInput {
  readonly actorPermissions: readonly string[];
  readonly marketplaceId: string;
  readonly name?: string;
}

export interface UpdateMarketplaceResult {
  readonly marketplace: Marketplace;
}

export interface UpdateMarketplaceDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: MarketplaceRepository;
  readonly database: TransactionManager;
  readonly eventRecorder: EventRecorder;
}

export class UpdateMarketplace {
  constructor(private readonly deps: UpdateMarketplaceDependencies) {}

  async execute(input: UpdateMarketplaceInput): Promise<UpdateMarketplaceResult> {
    requireMarketplaceManage(this.deps.authorization, input.actorPermissions);

    if (input.name === undefined) {
      throw new ValidationError('At least one field must be provided');
    }

    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Marketplace name is required');
    }

    const marketplace = await this.deps.database.execute(async (tx) => {
      const existing = await this.deps.repository.findById(tx, input.marketplaceId);
      if (existing === null) {
        throw new NotFoundError('Marketplace was not found', {
          marketplaceId: input.marketplaceId,
        });
      }

      if (existing.name === name) {
        return existing;
      }

      const updated = existing.updateName(name, new Date());
      await this.deps.repository.update(tx, updated);
      await this.deps.eventRecorder.record(tx, marketplaceUpdatedEvent(updated));
      return updated;
    });

    return { marketplace };
  }
}
