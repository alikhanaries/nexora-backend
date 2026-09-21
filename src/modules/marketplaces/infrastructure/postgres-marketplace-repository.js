import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Marketplace } from '../domain/marketplace.js';
import { MarketplaceStatus } from '../domain/marketplace-status.js';
const marketplaceRowSchema = z.object({
    id: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    status: z.enum([MarketplaceStatus.ACTIVE, MarketplaceStatus.INACTIVE]),
    created_at: z.date(),
    updated_at: z.date(),
});
function toMarketplace(row) {
    return Marketplace.reconstitute({
        id: row.id,
        key: row.key,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
export class PostgresMarketplaceRepository {
    async findById(queryable, id) {
        const result = await queryable.query(`SELECT id, key, name, status, created_at, updated_at
       FROM marketplaces
       WHERE id = $1`, [id], { operation: 'marketplaces.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toMarketplace(parseOrThrow(marketplaceRowSchema, row, 'marketplaces row'));
    }
    async findByKey(queryable, key) {
        const result = await queryable.query(`SELECT id, key, name, status, created_at, updated_at
       FROM marketplaces
       WHERE key = $1`, [key], { operation: 'marketplaces.find_by_key' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toMarketplace(parseOrThrow(marketplaceRowSchema, row, 'marketplaces row'));
    }
    async list(queryable, filters) {
        const conditions = [];
        const parameters = [];
        if (filters.status !== undefined) {
            parameters.push(filters.status);
            conditions.push(`status = $${parameters.length}`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await queryable.query(`SELECT id, key, name, status, created_at, updated_at
       FROM marketplaces
       ${whereClause}
       ORDER BY key ASC`, parameters, { operation: 'marketplaces.list' });
        return result.rows.map((row) => toMarketplace(parseOrThrow(marketplaceRowSchema, row, 'marketplaces row')));
    }
    async insert(transaction, marketplace) {
        await transaction.query(`INSERT INTO marketplaces (id, key, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            marketplace.id,
            marketplace.key,
            marketplace.name,
            marketplace.status,
            marketplace.createdAt,
            marketplace.updatedAt,
        ], { operation: 'marketplaces.insert' });
    }
    async update(transaction, marketplace) {
        await transaction.query(`UPDATE marketplaces
       SET name = $2, status = $3, updated_at = $4
       WHERE id = $1`, [marketplace.id, marketplace.name, marketplace.status, marketplace.updatedAt], { operation: 'marketplaces.update' });
    }
}
