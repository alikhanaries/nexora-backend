import type { Queryable, Transaction } from '../../../../shared/persistence/index.js';
import type { Product } from '../product.js';
import type { ProductStatus } from '../product-status.js';

export interface ListProductsFilter {
  readonly status?: ProductStatus | undefined;
}

export interface ListProductsPage {
  readonly items: readonly Product[];
  readonly hasMore: boolean;
}

export interface ProductRepository {
  findById(queryable: Queryable, tenantId: string, productId: string): Promise<Product | null>;
  findBySku(queryable: Queryable, tenantId: string, merchantSku: string): Promise<Product | null>;
  findByIds(
    queryable: Queryable,
    tenantId: string,
    productIds: readonly string[],
  ): Promise<readonly Product[]>;
  insert(transaction: Transaction, product: Product): Promise<void>;
  update(transaction: Transaction, product: Product): Promise<void>;
  listPage(
    queryable: Queryable,
    tenantId: string,
    filter: ListProductsFilter,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<ListProductsPage>;
}
