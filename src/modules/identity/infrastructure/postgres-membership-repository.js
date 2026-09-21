import { mapMembershipRow } from './row-mappers.js';
export class PostgresMembershipRepository {
    async findById(tx, id) {
        const result = await tx.query(`SELECT id, tenant_id, user_id, status, created_at, updated_at
       FROM tenant_memberships WHERE id = $1`, [id], { operation: 'identity.memberships.find_by_id' });
        if (result.rows.length === 0)
            return null;
        return mapMembershipRow(result.rows[0]);
    }
    async findByTenantAndUser(tx, tenantId, userId) {
        const result = await tx.query(`SELECT id, tenant_id, user_id, status, created_at, updated_at
       FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId], { operation: 'identity.memberships.find_by_tenant_user' });
        if (result.rows.length === 0)
            return null;
        return mapMembershipRow(result.rows[0]);
    }
    async save(tx, membership) {
        await tx.query(`INSERT INTO tenant_memberships (id, tenant_id, user_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`, [
            membership.id,
            membership.tenantId,
            membership.userId,
            membership.status,
            membership.createdAt,
            membership.updatedAt,
        ], { operation: 'identity.memberships.save' });
    }
}
