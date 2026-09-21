import { z } from 'zod';
import { ConflictError, NotFoundError } from '../../../shared/errors/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
const roleRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    name: z.string(),
    system_key: z.string().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    is_system: z.boolean(),
    cloned_from_role_id: z.string().uuid().nullable(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
});
const permissionRowSchema = z.object({
    id: z.string().uuid(),
    key: z.string(),
    description: z.string(),
    created_at: z.coerce.date(),
});
function mapRole(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        systemKey: row.system_key,
        status: row.status,
        isSystem: row.is_system,
        clonedFromRoleId: row.cloned_from_role_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapPermission(row) {
    return {
        id: row.id,
        key: row.key,
        description: row.description,
        createdAt: row.created_at,
    };
}
export class PostgresRoleRepository {
    async create(record, tx) {
        const insertResult = await tx.query(`INSERT INTO roles (tenant_id, name, system_key, is_system, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING id, tenant_id, name, system_key, status, is_system, cloned_from_role_id, created_at, updated_at`, [record.tenantId, record.name, record.systemKey, record.isSystem], { operation: 'authorization.roles.create' });
        const role = mapRole(parseOrThrow(roleRowSchema, insertResult.rows[0], 'role row'));
        await this.setRolePermissions(role.id, record.permissionKeys, tx);
        return { ...role, permissionKeys: [...record.permissionKeys].sort() };
    }
    async findById(roleId, tx) {
        const result = await tx.query(`SELECT id, tenant_id, name, system_key, status, is_system, cloned_from_role_id, created_at, updated_at
       FROM roles
       WHERE id = $1`, [roleId], { operation: 'authorization.roles.find_by_id' });
        if (result.rows.length === 0) {
            return null;
        }
        return mapRole(parseOrThrow(roleRowSchema, result.rows[0], 'role row'));
    }
    async findByTenantAndName(tenantId, name, tx) {
        const result = await tx.query(`SELECT id, tenant_id, name, system_key, status, is_system, cloned_from_role_id, created_at, updated_at
       FROM roles
       WHERE tenant_id = $1 AND lower(name) = lower($2)`, [tenantId, name], { operation: 'authorization.roles.find_by_tenant_and_name' });
        if (result.rows.length === 0) {
            return null;
        }
        return mapRole(parseOrThrow(roleRowSchema, result.rows[0], 'role row'));
    }
    async findSystemRoleByKey(tenantId, systemKey, tx) {
        const result = await tx.query(`SELECT id, tenant_id, name, system_key, status, is_system, cloned_from_role_id, created_at, updated_at
       FROM roles
       WHERE tenant_id = $1 AND system_key = $2`, [tenantId, systemKey], { operation: 'authorization.roles.find_system_by_key' });
        if (result.rows.length === 0) {
            return null;
        }
        return mapRole(parseOrThrow(roleRowSchema, result.rows[0], 'role row'));
    }
    async listByTenant(tenantId, tx) {
        const result = await tx.query(`SELECT id, tenant_id, name, system_key, status, is_system, cloned_from_role_id, created_at, updated_at
       FROM roles
       WHERE tenant_id = $1
       ORDER BY name ASC`, [tenantId], { operation: 'authorization.roles.list_by_tenant' });
        return result.rows.map((row) => mapRole(parseOrThrow(roleRowSchema, row, 'role row')));
    }
    async listPermissionsForRole(roleId, tx) {
        const result = await tx.query(`SELECT p.id, p.key, p.description, p.created_at
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.key ASC`, [roleId], { operation: 'authorization.roles.list_permissions' });
        return result.rows.map((row) => mapPermission(parseOrThrow(permissionRowSchema, row, 'permission row')));
    }
    async roleGrantsPermission(roleId, permissionKey, tx) {
        const result = await tx.query(`SELECT 1
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1 AND p.key = $2
       LIMIT 1`, [roleId, permissionKey], { operation: 'authorization.roles.grants_permission' });
        return result.rowCount > 0;
    }
    async setRolePermissions(roleId, permissionKeys, tx) {
        const permissionResult = await tx.query(`SELECT id, key
       FROM permissions
       WHERE key = ANY($1::text[])`, [permissionKeys], { operation: 'authorization.roles.resolve_permission_ids' });
        const resolvedKeys = new Set(permissionResult.rows.map((row) => String(row['key'])));
        const missing = permissionKeys.filter((key) => !resolvedKeys.has(key));
        if (missing.length > 0) {
            throw new NotFoundError('One or more permissions were not found', { missing });
        }
        await tx.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId], {
            operation: 'authorization.roles.clear_permissions',
        });
        for (const row of permissionResult.rows) {
            try {
                await tx.query(`INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)`, [roleId, row['id']], { operation: 'authorization.roles.add_permission' });
            }
            catch (error) {
                if (error instanceof ConflictError) {
                    throw error;
                }
                throw error;
            }
        }
    }
}
