import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { MarketplaceStatus } from './marketplace-status.js';
import type { Marketplace } from './marketplace.js';

export interface MarketplaceListFilters {
  readonly status?: MarketplaceStatus;
}

export interface MarketplaceRepository {
  findById(queryable: Queryable, id: string): Promise<Marketplace | null>;
  findByKey(queryable: Queryable, key: string): Promise<Marketplace | null>;
  list(queryable: Queryable, filters: MarketplaceListFilters): Promise<readonly Marketplace[]>;
  insert(transaction: Transaction, marketplace: Marketplace): Promise<void>;
  update(transaction: Transaction, marketplace: Marketplace): Promise<void>;
}
