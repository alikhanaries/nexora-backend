import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { reconstituteTenant } from '../models/tenant.js';
import { TenantStatus } from '../models/tenant-status.js';

const tenantRowSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    status: z.enum([TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CLOSED]),
    created_at: z.date(),
    updated_at: z.date(),
});

/**
 * @param {object} row
 */
function toTenant(row) {
    return reconstituteTenant({
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}

/**
 * Postgres persistence for tenants (function-based repository).
 * @returns {{
 *   findById: Function,
 *   findBySlug: Function,
 *   insert: Function,
 *   update: Function,
 * }}
 */
export function createPostgresTenantRepository() {
    return {
        /** Tenant row by id or null. */
        async findById(queryable, id) {
            const result = await queryable.query(
                `SELECT id, slug, name, status, created_at, updated_at
       FROM tenants
       WHERE id = $1`,
                [id],
                { operation: 'tenants.find_by_id' },
            );
            const row = result.rows[0];
            if (row === undefined) {
                return null;
            }
            return toTenant(parseOrThrow(tenantRowSchema, row, 'tenants row'));
        },

        /** Tenant row by unique slug or null. */
        async findBySlug(queryable, slug) {
            const result = await queryable.query(
                `SELECT id, slug, name, status, created_at, updated_at
       FROM tenants
       WHERE slug = $1`,
                [slug],
                { operation: 'tenants.find_by_slug' },
            );
            const row = result.rows[0];
            if (row === undefined) {
                return null;
            }
            return toTenant(parseOrThrow(tenantRowSchema, row, 'tenants row'));
        },

        /** Inserts tenant on registration/bootstrap. */
        async insert(transaction, tenant) {
            await transaction.query(
                `INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
                [tenant.id, tenant.slug, tenant.name, tenant.status, tenant.createdAt, tenant.updatedAt],
                { operation: 'tenants.insert' },
            );
        },

        /** Updates tenant status and updated_at (lifecycle transitions). */
        async update(transaction, tenant) {
            await transaction.query(
                `UPDATE tenants
       SET status = $2, updated_at = $3
       WHERE id = $1`,
                [tenant.id, tenant.status, tenant.updatedAt],
                { operation: 'tenants.update' },
            );
        },
    };
}
