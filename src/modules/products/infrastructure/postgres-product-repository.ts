import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type {
  ListProductsFilter,
  ListProductsPage,
  ProductRepository,
} from '../domain/ports/product-repository.js';
import type { Product } from '../domain/product.js';
import { PRODUCT_SELECT_COLUMNS, toProduct } from './row-mappers.js';

export class PostgresProductRepository implements ProductRepository {
  async findById(
    queryable: Queryable,
    tenantId: string,
    productId: string,
  ): Promise<Product | null> {
    const result = await queryable.query(
      `SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, productId],
      { operation: 'products.find_by_id' },
    );

    const row = result.rows[0];
    return row === undefined ? null : toProduct(row);
  }

  async findBySku(
    queryable: Queryable,
    tenantId: string,
    merchantSku: string,
  ): Promise<Product | null> {
    const result = await queryable.query(
      `SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE tenant_id = $1 AND merchant_sku = $2`,
      [tenantId, merchantSku],
      { operation: 'products.find_by_sku' },
    );

    const row = result.rows[0];
    return row === undefined ? null : toProduct(row);
  }

  async findByIds(
    queryable: Queryable,
    tenantId: string,
    productIds: readonly string[],
  ): Promise<readonly Product[]> {
    if (productIds.length === 0) return [];

    const result = await queryable.query(
      `SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, [...productIds]],
      { operation: 'products.find_by_ids' },
    );

    return result.rows.map(toProduct);
  }

  async insert(transaction: Transaction, product: Product): Promise<void> {
    await transaction.query(
      `INSERT INTO products
         (id, tenant_id, merchant_sku, external_reference, product_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        product.id,
        product.tenantId,
        product.merchantSku,
        product.externalReference,
        product.productType,
        product.status,
        product.createdAt,
        product.updatedAt,
      ],
      { operation: 'products.insert' },
    );
  }

  async update(transaction: Transaction, product: Product): Promise<void> {
    await transaction.query(
      `UPDATE products
       SET external_reference = $3,
           product_type = $4,
           status = $5,
           updated_at = $6
       WHERE tenant_id = $1 AND id = $2`,
      [
        product.tenantId,
        product.id,
        product.externalReference,
        product.productType,
        product.status,
        product.updatedAt,
      ],
      { operation: 'products.update' },
    );
  }

  async listPage(
    queryable: Queryable,
    tenantId: string,
    filter: ListProductsFilter,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<ListProductsPage> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (filter.status !== undefined) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    if (cursorCreatedAt !== null && cursorId !== null) {
      params.push(cursorCreatedAt, cursorId);
      conditions.push(
        `(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
      );
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const result = await queryable.query(
      `SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limitParam}`,
      params,
      { operation: 'products.list_page' },
    );

    const items = result.rows.map(toProduct);
    return {
      items,
      hasMore: items.length === limit,
    };
  }
}
