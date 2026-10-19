import { mapUserRow } from './row-mappers.js';
export class PostgresUserRepository {
    async findById(tx, id) {
        const result = await tx.query(`SELECT id, email, normalized_email, status, created_at, updated_at
       FROM users WHERE id = $1`, [id], { operation: 'identity.users.find_by_id' });
        if (result.rows.length === 0)
            return null;
        return mapUserRow(result.rows[0]);
    }
    async findByNormalizedEmail(tx, normalizedEmail) {
        const result = await tx.query(`SELECT id, email, normalized_email, status, created_at, updated_at
       FROM users WHERE normalized_email = $1`, [normalizedEmail], { operation: 'identity.users.find_by_email' });
        if (result.rows.length === 0)
            return null;
        return mapUserRow(result.rows[0]);
    }
    async save(tx, user) {
        await tx.query(`INSERT INTO users (id, email, normalized_email, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         normalized_email = EXCLUDED.normalized_email,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`, [user.id, user.email.raw, user.email.normalized, user.status, user.createdAt, user.updatedAt], { operation: 'identity.users.save' });
    }
}
