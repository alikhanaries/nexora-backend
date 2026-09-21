import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { Price } from './price.js';
import type { PriceStatus } from './price-status.js';

export interface PriceListFilters {
  readonly productId?: string | undefined;
  readonly channelId?: string | null | undefined;
  readonly currency?: string | undefined;
  readonly status?: PriceStatus | undefined;
}

export interface PriceRepository {
  findById(queryable: Queryable, tenantId: string, priceId: string): Promise<Price | null>;

  findEffective(
    queryable: Queryable,
    tenantId: string,
    productId: string,
    channelId: string,
    currency: string,
    at: Date,
  ): Promise<Price | null>;

  listPage(
    queryable: Queryable,
    tenantId: string,
    filters: PriceListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Price[] }>;

  insert(transaction: Transaction, price: Price): Promise<void>;
  update(transaction: Transaction, price: Price): Promise<void>;
}
