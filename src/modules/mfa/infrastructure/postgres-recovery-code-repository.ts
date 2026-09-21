import { randomUUID } from 'node:crypto';
import type { Transaction } from '../../../shared/persistence/index.js';
import type { RecoveryCodeRepository } from '../application/ports/recovery-code-repository.js';

export class PostgresRecoveryCodeRepository implements RecoveryCodeRepository {
  async createBatch(
    tx: Transaction,
    input: {
      readonly userId: string;
      readonly tenantId: string;
      readonly codeHashes: readonly string[];
    },
  ): Promise<void> {
    for (const codeHash of input.codeHashes) {
      await tx.query(
        `INSERT INTO recovery_codes (id, user_id, tenant_id, code_hash)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), input.userId, input.tenantId, codeHash],
        { operation: 'recovery_codes.create' },
      );
    }
  }

  async findActiveByHash(
    tx: Transaction,
    codeHash: string,
  ): Promise<{ id: string; userId: string; tenantId: string } | null> {
    const result = await tx.query(
      `SELECT id, user_id, tenant_id
       FROM recovery_codes
       WHERE code_hash = $1 AND status = 'ACTIVE'`,
      [codeHash],
      { operation: 'recovery_codes.find_by_hash' },
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0]!;
    return {
      id: String(row['id']),
      userId: String(row['user_id']),
      tenantId: String(row['tenant_id']),
    };
  }

  async markUsed(tx: Transaction, id: string, usedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE recovery_codes SET status = 'USED', used_at = $2 WHERE id = $1`,
      [id, usedAt],
      { operation: 'recovery_codes.mark_used' },
    );
  }

  async revokeAllForUser(tx: Transaction, userId: string, tenantId: string): Promise<void> {
    await tx.query(
      `UPDATE recovery_codes SET status = 'REVOKED'
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
      [userId, tenantId],
      { operation: 'recovery_codes.revoke_all' },
    );
  }
}
