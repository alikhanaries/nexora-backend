import type { Transaction } from '../../../shared/persistence/index.js';
import type { User } from '../domain/index.js';
import type { UserRepository } from '../application/ports/user-repository.js';
import { mapUserRow } from './row-mappers.js';

export class PostgresUserRepository implements UserRepository {
  async findById(tx: Transaction, id: string): Promise<User | null> {
    const result = await tx.query(
      `SELECT id, email, normalized_email, status, created_at, updated_at
       FROM users WHERE id = $1`,
      [id],
      { operation: 'identity.users.find_by_id' },
    );
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0]);
  }

  async findByNormalizedEmail(tx: Transaction, normalizedEmail: string): Promise<User | null> {
    const result = await tx.query(
      `SELECT id, email, normalized_email, status, created_at, updated_at
       FROM users WHERE normalized_email = $1`,
      [normalizedEmail],
      { operation: 'identity.users.find_by_email' },
    );
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0]);
  }

  async save(tx: Transaction, user: User): Promise<void> {
    await tx.query(
      `INSERT INTO users (id, email, normalized_email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         normalized_email = EXCLUDED.normalized_email,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [user.id, user.email.raw, user.email.normalized, user.status, user.createdAt, user.updatedAt],
      { operation: 'identity.users.save' },
    );
  }
}
