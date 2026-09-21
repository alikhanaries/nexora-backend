import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Tenant } from '../domain/tenant.js';
import { TenantStatus } from '../domain/tenant-status.js';
const tenantRowSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    status: z.enum([TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CLOSED]),
    created_at: z.date(),
    updated_at: z.date(),
});
function toTenant(row) {
    return Tenant.reconstitute({
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
export class PostgresTenantRepository {
    async findById(queryable, id) {
        const result = await queryable.query(`SELECT id, slug, name, status, created_at, updated_at
       FROM tenants
       WHERE id = $1`, [id], { operation: 'tenants.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toTenant(parseOrThrow(tenantRowSchema, row, 'tenants row'));
    }
    async findBySlug(queryable, slug) {
        const result = await queryable.query(`SELECT id, slug, name, status, created_at, updated_at
       FROM tenants
       WHERE slug = $1`, [slug], { operation: 'tenants.find_by_slug' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toTenant(parseOrThrow(tenantRowSchema, row, 'tenants row'));
    }
    async insert(transaction, tenant) {
        await transaction.query(`INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`, [tenant.id, tenant.slug, tenant.name, tenant.status, tenant.createdAt, tenant.updatedAt], { operation: 'tenants.insert' });
    }
    async update(transaction, tenant) {
        await transaction.query(`UPDATE tenants
       SET status = $2, updated_at = $3
       WHERE id = $1`, [tenant.id, tenant.status, tenant.updatedAt], { operation: 'tenants.update' });
    }
}
