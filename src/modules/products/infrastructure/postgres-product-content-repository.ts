import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { ProductContentRepository } from '../domain/ports/product-content-repository.js';
import type { ProductContent } from '../domain/product-content.js';
import { PRODUCT_CONTENT_SELECT_COLUMNS, toProductContent } from './row-mappers.js';

export class PostgresProductContentRepository implements ProductContentRepository {
  async findByProductAndLocale(
    queryable: Queryable,
    tenantId: string,
    productId: string,
    locale: string,
  ): Promise<ProductContent | null> {
    const result = await queryable.query(
      `SELECT ${PRODUCT_CONTENT_SELECT_COLUMNS}
       FROM product_content
       WHERE tenant_id = $1 AND product_id = $2 AND locale = $3`,
      [tenantId, productId, locale],
      { operation: 'product_content.find_by_product_locale' },
    );

    const row = result.rows[0];
    return row === undefined ? null : toProductContent(row);
  }

  async listByProduct(
    queryable: Queryable,
    tenantId: string,
    productId: string,
  ): Promise<readonly ProductContent[]> {
    const result = await queryable.query(
      `SELECT ${PRODUCT_CONTENT_SELECT_COLUMNS}
       FROM product_content
       WHERE tenant_id = $1 AND product_id = $2
       ORDER BY locale ASC`,
      [tenantId, productId],
      { operation: 'product_content.list_by_product' },
    );

    return result.rows.map(toProductContent);
  }

  async upsert(transaction: Transaction, content: ProductContent): Promise<void> {
    await transaction.query(
      `INSERT INTO product_content
         (id, product_id, tenant_id, locale, title, description, brand, attributes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       ON CONFLICT (product_id, locale)
       DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         brand = EXCLUDED.brand,
         attributes = EXCLUDED.attributes,
         updated_at = EXCLUDED.updated_at`,
      [
        content.id,
        content.productId,
        content.tenantId,
        content.locale,
        content.title,
        content.description,
        content.brand,
        JSON.stringify(content.attributes),
        content.createdAt,
        content.updatedAt,
      ],
      { operation: 'product_content.upsert' },
    );
  }
}
