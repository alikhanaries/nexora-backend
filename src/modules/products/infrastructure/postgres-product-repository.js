import { PRODUCT_SELECT_COLUMNS, toProduct } from './row-mappers.js';
export class PostgresProductRepository {
    async findById(queryable, tenantId, productId) {
        const result = await queryable.query(`SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE tenant_id = $1 AND id = $2`, [tenantId, productId], { operation: 'products.find_by_id' });
        const row = result.rows[0];
        return row === undefined ? null : toProduct(row);
    }
    async findBySku(queryable, tenantId, merchantSku) {
        const result = await queryable.query(`SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE tenant_id = $1 AND merchant_sku = $2`, [tenantId, merchantSku], { operation: 'products.find_by_sku' });
        const row = result.rows[0];
        return row === undefined ? null : toProduct(row);
    }
    async findByIds(queryable, tenantId, productIds) {
        if (productIds.length === 0)
            return [];
        const result = await queryable.query(`SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, [...productIds]], { operation: 'products.find_by_ids' });
        return result.rows.map(toProduct);
    }
    async insert(transaction, product) {
        await transaction.query(`INSERT INTO products
         (id, tenant_id, merchant_sku, external_reference, product_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            product.id,
            product.tenantId,
            product.merchantSku,
            product.externalReference,
            product.productType,
            product.status,
            product.createdAt,
            product.updatedAt,
        ], { operation: 'products.insert' });
    }
    async update(transaction, product) {
        await transaction.query(`UPDATE products
       SET external_reference = $3,
           product_type = $4,
           status = $5,
           updated_at = $6
       WHERE tenant_id = $1 AND id = $2`, [
            product.tenantId,
            product.id,
            product.externalReference,
            product.productType,
            product.status,
            product.updatedAt,
        ], { operation: 'products.update' });
    }
    async listPage(queryable, tenantId, filter, limit, cursorCreatedAt, cursorId) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
        if (filter.status !== undefined) {
            params.push(filter.status);
            conditions.push(`status = $${params.length}`);
        }
        if (cursorCreatedAt !== null && cursorId !== null) {
            params.push(cursorCreatedAt, cursorId);
            conditions.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
        }
        params.push(limit);
        const limitParam = `$${params.length}`;
        const result = await queryable.query(`SELECT ${PRODUCT_SELECT_COLUMNS}
       FROM products
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limitParam}`, params, { operation: 'products.list_page' });
        const items = result.rows.map(toProduct);
        return {
            items,
            hasMore: items.length === limit,
        };
    }
}
