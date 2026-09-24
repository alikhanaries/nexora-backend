import { TenantStatus } from '../../tenants/public/index.js';
import { clampBatchSize } from '../../../shared/pagination/index.js';
import { resolveExternalIdBackfillTable } from '../domain/external-id-backfill.js';

export class PostgresExternalIdBackfillQueries {
    /**
     * @param {object} queryable
     */
    async listActiveTenantIds(queryable) {
        const result = await queryable.query(
            `SELECT id
       FROM tenants
       WHERE status = $1
       ORDER BY id`,
            [TenantStatus.ACTIVE],
            { operation: 'external_id_backfill.list_active_tenants' },
        );
        return result.rows.map((row) => String(row.id));
    }

    /**
     * @param {object} queryable
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {string|null} afterResourceId
     * @param {number} batchSize
     */
    async findUnmappedResourceIds(queryable, tenantId, provider, resourceType, afterResourceId, batchSize) {
        const table = resolveExternalIdBackfillTable(resourceType);
        const limit = clampBatchSize(batchSize);
        const params = [tenantId, provider, resourceType];
        let cursorSql = '';
        if (afterResourceId !== null) {
            params.push(afterResourceId);
            cursorSql = `AND r.id > $${params.length}::uuid`;
        }
        params.push(limit);
        const limitParam = `$${params.length}`;
        const result = await queryable.query(
            `SELECT r.id
       FROM ${table} AS r
       WHERE r.tenant_id = $1
         ${cursorSql}
         AND NOT EXISTS (
           SELECT 1
           FROM external_integer_id_mappings AS m
           WHERE m.tenant_id = r.tenant_id
             AND m.provider = $2
             AND m.resource_type = $3
             AND m.resource_id = r.id
         )
       ORDER BY r.id
       LIMIT ${limitParam}`,
            params,
            { operation: `external_id_backfill.find_unmapped.${resourceType}` },
        );
        return result.rows.map((row) => String(row.id));
    }
}
