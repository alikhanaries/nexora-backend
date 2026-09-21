import { randomUUID } from 'node:crypto';
export class PostgresRecoveryCodeRepository {
    async createBatch(tx, input) {
        for (const codeHash of input.codeHashes) {
            await tx.query(`INSERT INTO recovery_codes (id, user_id, tenant_id, code_hash)
         VALUES ($1, $2, $3, $4)`, [randomUUID(), input.userId, input.tenantId, codeHash], { operation: 'recovery_codes.create' });
        }
    }
    async findActiveByHash(tx, codeHash) {
        const result = await tx.query(`SELECT id, user_id, tenant_id
       FROM recovery_codes
       WHERE code_hash = $1 AND status = 'ACTIVE'`, [codeHash], { operation: 'recovery_codes.find_by_hash' });
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: String(row['id']),
            userId: String(row['user_id']),
            tenantId: String(row['tenant_id']),
        };
    }
    async markUsed(tx, id, usedAt) {
        await tx.query(`UPDATE recovery_codes SET status = 'USED', used_at = $2 WHERE id = $1`, [id, usedAt], { operation: 'recovery_codes.mark_used' });
    }
    async revokeAllForUser(tx, userId, tenantId) {
        await tx.query(`UPDATE recovery_codes SET status = 'REVOKED'
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`, [userId, tenantId], { operation: 'recovery_codes.revoke_all' });
    }
}
