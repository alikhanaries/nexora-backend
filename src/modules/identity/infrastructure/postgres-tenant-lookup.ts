import type { Transaction } from '../../../shared/persistence/index.js';
import type { TenantLookup, TenantRecord } from '../application/ports/tenant-lookup.js';
import { mapTenantRow } from './row-mappers.js';

export class PostgresTenantLookup implements TenantLookup {
  async findBySlug(tx: Transaction, slug: string): Promise<TenantRecord | null> {
    const result = await tx.query(
      `SELECT id, slug, name, status FROM tenants WHERE slug = $1`,
      [slug],
      { operation: 'identity.tenants.find_by_slug' },
    );
    if (result.rows.length === 0) return null;
    return mapTenantRow(result.rows[0]);
  }
}
