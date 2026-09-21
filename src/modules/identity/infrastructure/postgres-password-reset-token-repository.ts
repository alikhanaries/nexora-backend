import type { Transaction } from '../../../shared/persistence/index.js';
import type {
  PasswordResetTokenRecord,
  PasswordResetTokenRepository,
} from '../application/ports/password-reset-token-repository.js';
import { mapPasswordResetTokenRow } from './row-mappers.js';

export class PostgresPasswordResetTokenRepository implements PasswordResetTokenRepository {
  async save(tx: Transaction, token: PasswordResetTokenRecord): Promise<void> {
    await tx.query(
      `INSERT INTO password_reset_tokens (
         id, user_id, token_hash, status, expires_at, created_at, used_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        token.id,
        token.userId,
        token.tokenHash,
        token.status,
        token.expiresAt,
        token.createdAt,
        token.usedAt,
      ],
      { operation: 'identity.password_reset_tokens.save' },
    );
  }

  async findActiveByTokenHash(
    tx: Transaction,
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null> {
    const result = await tx.query(
      `SELECT id, user_id, token_hash, status, expires_at, created_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1 AND status = 'ACTIVE'`,
      [tokenHash],
      { operation: 'identity.password_reset_tokens.find_active' },
    );
    if (result.rows.length === 0) return null;
    return mapPasswordResetTokenRow(result.rows[0]);
  }

  async markUsed(tx: Transaction, id: string, usedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE password_reset_tokens SET status = 'USED', used_at = $2 WHERE id = $1`,
      [id, usedAt],
      { operation: 'identity.password_reset_tokens.mark_used' },
    );
  }

  async revokeActiveForUser(tx: Transaction, userId: string): Promise<void> {
    await tx.query(
      `UPDATE password_reset_tokens SET status = 'REVOKED'
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId],
      { operation: 'identity.password_reset_tokens.revoke_active' },
    );
  }
}
