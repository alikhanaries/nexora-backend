import type { Transaction } from '../../../shared/persistence/index.js';
import type { PasswordCredentialRepository } from '../application/ports/password-credential-repository.js';

export class PostgresPasswordCredentialRepository implements PasswordCredentialRepository {
  async findHashByUserId(tx: Transaction, userId: string): Promise<string | null> {
    const result = await tx.query(
      `SELECT password_hash FROM password_credentials WHERE user_id = $1`,
      [userId],
      { operation: 'identity.credentials.find_by_user' },
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (typeof row?.password_hash !== 'string') return null;
    return row.password_hash;
  }

  async save(tx: Transaction, userId: string, passwordHash: string): Promise<void> {
    await tx.query(
      `INSERT INTO password_credentials (user_id, password_hash, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (user_id) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = now()`,
      [userId, passwordHash],
      { operation: 'identity.credentials.save' },
    );
  }
}
