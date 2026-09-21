import { randomUUID } from 'node:crypto';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { ConflictError, ValidationError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import { Marketplace } from '../domain/marketplace.js';
import { normalizeMarketplaceKey, validateMarketplaceKey } from '../domain/marketplace-key.js';
import type { MarketplaceRepository } from '../domain/marketplace-repository.port.js';
import { marketplaceCreatedEvent } from './marketplace-events.js';
import { requireMarketplaceManage } from './marketplace-permissions.js';

export interface CreateMarketplaceInput {
  readonly actorPermissions: readonly string[];
  readonly key: string;
  readonly name: string;
}

export interface CreateMarketplaceResult {
  readonly marketplace: Marketplace;
}

export interface CreateMarketplaceDependencies {
  readonly authorization: AuthorizationService;
  readonly repository: MarketplaceRepository;
  readonly database: TransactionManager;
  readonly eventRecorder: EventRecorder;
}

export class CreateMarketplace {
  constructor(private readonly deps: CreateMarketplaceDependencies) {}

  async execute(input: CreateMarketplaceInput): Promise<CreateMarketplaceResult> {
    requireMarketplaceManage(this.deps.authorization, input.actorPermissions);

    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Marketplace name is required');
    }

    validateMarketplaceKey(input.key);
    const key = normalizeMarketplaceKey(input.key);
    const now = new Date();
    const marketplace = Marketplace.create({
      id: randomUUID(),
      key,
      name,
      createdAt: now,
    });

    await this.deps.database.execute(async (tx) => {
      const existing = await this.deps.repository.findByKey(tx, key);
      if (existing !== null) {
        throw new ConflictError('A marketplace with this key already exists', { key });
      }

      await this.deps.repository.insert(tx, marketplace);
      await this.deps.eventRecorder.record(tx, marketplaceCreatedEvent(marketplace));
    });

    return { marketplace };
  }
}
