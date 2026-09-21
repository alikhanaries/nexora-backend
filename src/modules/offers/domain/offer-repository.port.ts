import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { Offer } from './offer.js';
import type { OfferStatus } from './offer-status.js';

export interface OfferListFilters {
  readonly productId?: string | undefined;
  readonly channelId?: string | undefined;
  readonly status?: OfferStatus | undefined;
}

export interface OfferRepository {
  findById(queryable: Queryable, tenantId: string, offerId: string): Promise<Offer | null>;

  findByProductAndChannel(
    queryable: Queryable,
    tenantId: string,
    productId: string,
    channelId: string,
  ): Promise<Offer | null>;

  listByProduct(
    queryable: Queryable,
    tenantId: string,
    productId: string,
    filters?: OfferListFilters,
  ): Promise<readonly Offer[]>;

  listPage(
    queryable: Queryable,
    tenantId: string,
    filters: OfferListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Offer[] }>;

  insert(transaction: Transaction, offer: Offer): Promise<void>;
  update(transaction: Transaction, offer: Offer): Promise<void>;
}
