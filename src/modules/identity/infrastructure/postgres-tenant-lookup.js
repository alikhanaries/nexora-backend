import { mapTenantRow } from './row-mappers.js';
export class PostgresTenantLookup {
    async findBySlug(tx, slug) {
        const result = await tx.query(`SELECT id, slug, name, status FROM tenants WHERE slug = $1`, [slug], { operation: 'identity.tenants.find_by_slug' });
        if (result.rows.length === 0)
            return null;
        return mapTenantRow(result.rows[0]);
    }
}
