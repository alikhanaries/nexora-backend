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
export class PostgresPermissionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async listAll() {
        const result = await this.db.query(`SELECT id, key, description, created_at
       FROM permissions
       ORDER BY key ASC`, [], { operation: 'authorization.permissions.list_all' });
        return result.rows.map((row) => mapPermission(parseOrThrow(permissionRowSchema, row, 'permission row')));
    }
    async listKeys() {
        const permissions = await this.listAll();
        return permissions.map((permission) => permission.key);
    }
}
