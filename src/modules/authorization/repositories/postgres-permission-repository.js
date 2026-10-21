import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
const permissionRowSchema = z.object({
    id: z.string().uuid(),
    key: z.string(),
    description: z.string(),
    created_at: z.coerce.date(),
});
function mapPermission(row) {
    return {
        id: row.id,
        key: row.key,
        description: row.description,
        createdAt: row.created_at,
    };
}
/**
 * Postgres persistence (function-based repository).
 * @returns {object}
 */
export function createPostgresPermissionRepository(db) {
    async function listAll() {
        const result = await db.query(`SELECT id, key, description, created_at
       FROM permissions
       ORDER BY key ASC`, [], { operation: 'authorization.permissions.list_all' });
        return result.rows.map((row) => mapPermission(parseOrThrow(permissionRowSchema, row, 'permission row')));
    }
    async function listKeys() {
        const permissions = await listAll();
        return permissions.map((permission) => permission.key);
    }
    return {
        listAll,
        listKeys,
    };
}
