import type { Queryable, Transaction } from '../../../../shared/persistence/index.js';
import type { ProductContent } from '../product-content.js';

export interface ProductContentRepository {
  findByProductAndLocale(
    queryable: Queryable,
    tenantId: string,
    productId: string,
    locale: string,
  ): Promise<ProductContent | null>;
  listByProduct(
    queryable: Queryable,
    tenantId: string,
    productId: string,
  ): Promise<readonly ProductContent[]>;
  upsert(transaction: Transaction, content: ProductContent): Promise<void>;
}
