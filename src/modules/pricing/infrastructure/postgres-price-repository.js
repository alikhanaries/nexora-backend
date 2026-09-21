import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Price } from '../domain/price.js';
import { PriceStatus } from '../domain/price-status.js';
const priceRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    product_id: z.string().uuid(),
    channel_id: z.string().uuid().nullable(),
    currency: z.string(),
    amount_minor: z.coerce.number(),
    valid_from: z.date(),
    valid_to: z.date().nullable(),
    status: z.enum([PriceStatus.ACTIVE, PriceStatus.INACTIVE]),
    created_at: z.date(),
    updated_at: z.date(),
});
function toPrice(row) {
    return Price.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        productId: row.product_id,
        channelId: row.channel_id,
        currency: row.currency,
        amountMinor: row.amount_minor,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
const priceSelectColumns = `id, tenant_id, product_id, channel_id, currency, amount_minor,
  valid_from, valid_to, status, created_at, updated_at`;
export class PostgresPriceRepository {
    async findById(queryable, tenantId, priceId) {
        const result = await queryable.query(`SELECT ${priceSelectColumns}
       FROM prices
       WHERE tenant_id = $1 AND id = $2`, [tenantId, priceId], { operation: 'prices.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toPrice(parseOrThrow(priceRowSchema, row, 'prices row'));
    }
    async findEffective(queryable, tenantId, productId, channelId, currency, at) {
        const result = await queryable.query(`SELECT ${priceSelectColumns}
       FROM prices
       WHERE tenant_id = $1
         AND product_id = $2
         AND currency = $3
         AND status = 'ACTIVE'
         AND valid_from <= $4
         AND (valid_to IS NULL OR valid_to > $4)
         AND (channel_id = $5 OR channel_id IS NULL)
       ORDER BY
         CASE WHEN channel_id IS NOT NULL THEN 0 ELSE 1 END,
         valid_from DESC
       LIMIT 1`, [tenantId, productId, currency, at, channelId], { operation: 'prices.find_effective' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toPrice(parseOrThrow(priceRowSchema, row, 'prices row'));
    }
    async listPage(queryable, tenantId, filters, limit, cursorCreatedAt, cursorId) {
        const conditions = ['tenant_id = $1'];
        const parameters = [tenantId];
        if (filters.productId !== undefined) {
            parameters.push(filters.productId);
            conditions.push(`product_id = $${parameters.length}`);
        }
        if (filters.channelId !== undefined) {
            if (filters.channelId === null) {
                conditions.push('channel_id IS NULL');
            }
            else {
                parameters.push(filters.channelId);
                conditions.push(`channel_id = $${parameters.length}`);
            }
        }
        if (filters.currency !== undefined) {
            parameters.push(filters.currency);
            conditions.push(`currency = $${parameters.length}`);
        }
        if (filters.status !== undefined) {
            parameters.push(filters.status);
            conditions.push(`status = $${parameters.length}`);
        }
        if (cursorCreatedAt !== null && cursorId !== null) {
            parameters.push(cursorCreatedAt, cursorId);
            conditions.push(`(created_at, id) < ($${parameters.length - 1}, $${parameters.length})`);
        }
        parameters.push(limit);
        const result = await queryable.query(`SELECT ${priceSelectColumns}
       FROM prices
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${parameters.length}`, parameters, { operation: 'prices.list_page' });
        return {
            items: result.rows.map((row) => toPrice(parseOrThrow(priceRowSchema, row, 'prices row'))),
        };
    }
    async insert(transaction, price) {
        await transaction.query(`INSERT INTO prices (
         id, tenant_id, product_id, channel_id, currency, amount_minor,
         valid_from, valid_to, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
            price.id,
            price.tenantId,
            price.productId,
            price.channelId,
            price.currency,
            price.amountMinor,
            price.validFrom,
            price.validTo,
            price.status,
            price.createdAt,
            price.updatedAt,
        ], { operation: 'prices.insert' });
    }
    async update(transaction, price) {
        await transaction.query(`UPDATE prices
       SET channel_id = $3,
           amount_minor = $4,
           valid_from = $5,
           valid_to = $6,
           status = $7,
           updated_at = $8
       WHERE tenant_id = $1 AND id = $2`, [
            price.tenantId,
            price.id,
            price.channelId,
            price.amountMinor,
            price.validFrom,
            price.validTo,
            price.status,
            price.updatedAt,
        ], { operation: 'prices.update' });
    }
}
