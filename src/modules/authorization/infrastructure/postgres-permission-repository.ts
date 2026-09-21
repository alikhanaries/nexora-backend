import { z } from 'zod';
import type { Queryable } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import type { Permission } from '../domain/permission.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';

const permissionRowSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  description: z.string(),
  created_at: z.coerce.date(),
});

function mapPermission(row: z.infer<typeof permissionRowSchema>): Permission {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    createdAt: row.created_at,
  };
}

export class PostgresPermissionRepository implements PermissionRepository {
  constructor(private readonly db: Queryable) {}

  async listAll(): Promise<readonly Permission[]> {
    const result = await this.db.query(
      `SELECT id, key, description, created_at
       FROM permissions
       ORDER BY key ASC`,
      [],
      { operation: 'authorization.permissions.list_all' },
    );

    return result.rows.map((row) =>
      mapPermission(parseOrThrow(permissionRowSchema, row, 'permission row')),
    );
  }

  async listKeys(): Promise<readonly string[]> {
    const permissions = await this.listAll();
    return permissions.map((permission) => permission.key);
  }
}
