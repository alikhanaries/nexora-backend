import { z } from 'zod';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Tenant } from '../domain/tenant.js';
import { TenantStatus } from '../domain/tenant-status.js';
import type { TenantRepository } from '../domain/tenant-repository.port.js';

const tenantRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum([TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CLOSED]),
  created_at: z.date(),
  updated_at: z.date(),
});

function toTenant(row: z.infer<typeof tenantRowSchema>): Tenant {
  return Tenant.reconstitute({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class PostgresTenantRepository implements TenantRepository {
  async findById(queryable: Queryable, id: string): Promise<Tenant | null> {
    const result = await queryable.query(
      `SELECT id, slug, name, status, created_at, updated_at
       FROM tenants
       WHERE id = $1`,
      [id],
      { operation: 'tenants.find_by_id' },
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return toTenant(parseOrThrow(tenantRowSchema, row, 'tenants row'));
  }

  async findBySlug(queryable: Queryable, slug: string): Promise<Tenant | null> {
    const result = await queryable.query(
      `SELECT id, slug, name, status, created_at, updated_at
       FROM tenants
       WHERE slug = $1`,
      [slug],
      { operation: 'tenants.find_by_slug' },
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return toTenant(parseOrThrow(tenantRowSchema, row, 'tenants row'));
  }

  async insert(transaction: Transaction, tenant: Tenant): Promise<void> {
    await transaction.query(
      `INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenant.id, tenant.slug, tenant.name, tenant.status, tenant.createdAt, tenant.updatedAt],
      { operation: 'tenants.insert' },
    );
  }

  async update(transaction: Transaction, tenant: Tenant): Promise<void> {
    await transaction.query(
      `UPDATE tenants
       SET status = $2, updated_at = $3
       WHERE id = $1`,
      [tenant.id, tenant.status, tenant.updatedAt],
      { operation: 'tenants.update' },
    );
  }
}
