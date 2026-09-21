import type { Transaction } from '../../../shared/persistence/index.js';
import type { RefreshSession } from '../domain/index.js';
import type { RefreshSessionRepository } from '../application/ports/refresh-session-repository.js';
import { mapRefreshSessionRow } from './row-mappers.js';

export class PostgresRefreshSessionRepository implements RefreshSessionRepository {
  async findByTokenHash(tx: Transaction, tokenHash: string): Promise<RefreshSession | null> {
    const result = await tx.query(
      `SELECT id, user_id, tenant_id, token_hash, family_id, status,
              expires_at, created_at, last_used_at, revoked_at, replaced_by
       FROM refresh_sessions WHERE token_hash = $1`,
      [tokenHash],
      { operation: 'identity.refresh_sessions.find_by_hash' },
    );
    if (result.rows.length === 0) return null;
    return mapRefreshSessionRow(result.rows[0]);
  }

  async findById(tx: Transaction, id: string): Promise<RefreshSession | null> {
    const result = await tx.query(
      `SELECT id, user_id, tenant_id, token_hash, family_id, status,
              expires_at, created_at, last_used_at, revoked_at, replaced_by
       FROM refresh_sessions WHERE id = $1`,
      [id],
      { operation: 'identity.refresh_sessions.find_by_id' },
    );
    if (result.rows.length === 0) return null;
    return mapRefreshSessionRow(result.rows[0]);
  }

  async save(tx: Transaction, session: RefreshSession): Promise<void> {
    await tx.query(
      `INSERT INTO refresh_sessions (
         id, user_id, tenant_id, token_hash, family_id, status,
         expires_at, created_at, last_used_at, revoked_at, replaced_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         last_used_at = EXCLUDED.last_used_at,
         revoked_at = EXCLUDED.revoked_at,
         replaced_by = EXCLUDED.replaced_by`,
      [
        session.id,
        session.userId,
        session.tenantId,
        session.tokenHash,
        session.familyId,
        session.status,
        session.expiresAt,
        session.createdAt,
        session.lastUsedAt,
        session.revokedAt,
        session.replacedBy,
      ],
      { operation: 'identity.refresh_sessions.save' },
    );
  }

  async markReplaced(
    tx: Transaction,
    sessionId: string,
    replacedById: string,
    lastUsedAt: Date,
  ): Promise<void> {
    await tx.query(
      `UPDATE refresh_sessions
       SET status = 'REPLACED', replaced_by = $2, last_used_at = $3
       WHERE id = $1`,
      [sessionId, replacedById, lastUsedAt],
      { operation: 'identity.refresh_sessions.mark_replaced' },
    );
  }

  async revokeFamily(tx: Transaction, familyId: string, revokedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE refresh_sessions
       SET status = 'REVOKED', revoked_at = $2
       WHERE family_id = $1 AND status = 'ACTIVE'`,
      [familyId, revokedAt],
      { operation: 'identity.refresh_sessions.revoke_family' },
    );
  }

  async revokeAllForUser(tx: Transaction, userId: string, revokedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE refresh_sessions
       SET status = 'REVOKED', revoked_at = $2
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId, revokedAt],
      { operation: 'identity.refresh_sessions.revoke_all_for_user' },
    );
  }

  async revokeById(tx: Transaction, sessionId: string, revokedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE refresh_sessions
       SET status = 'REVOKED', revoked_at = $2
       WHERE id = $1 AND status = 'ACTIVE'`,
      [sessionId, revokedAt],
      { operation: 'identity.refresh_sessions.revoke_by_id' },
    );
  }
}
