import { z } from 'zod';
import { ConflictError } from '../../../shared/errors/index.js';
import type { Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import type { MembershipPermissionContext } from '../domain/effective-permissions.js';
import type {
  MembershipRoleRepository,
  MembershipSummary,
} from '../domain/ports/membership-role-repository.js';
import { TENANT_ADMIN_PERMISSION } from '../domain/permission.js';
import type { Role, SystemRoleKey } from '../domain/role.js';

const membershipRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED']),
});

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

function mapRole(row: z.infer<typeof roleRowSchema>): Role {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    systemKey: row.system_key as SystemRoleKey | null,
    status: row.status,
    isSystem: row.is_system,
    clonedFromRoleId: row.cloned_from_role_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresMembershipRoleRepository implements MembershipRoleRepository {
  async findMembership(membershipId: string, tx: Transaction): Promise<MembershipSummary | null> {
    const result = await tx.query(
      `SELECT id, tenant_id, status
       FROM tenant_memberships
       WHERE id = $1`,
      [membershipId],
      { operation: 'authorization.memberships.find' },
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = parseOrThrow(membershipRowSchema, result.rows[0], 'membership row');
    return {
      id: row.id,
      tenantId: row.tenant_id,
      status: row.status,
    };
  }

  async assignRole(membershipId: string, roleId: string, tx: Transaction): Promise<void> {
    try {
      await tx.query(
        `INSERT INTO membership_roles (membership_id, role_id)
         VALUES ($1, $2)`,
        [membershipId, roleId],
        { operation: 'authorization.membership_roles.assign' },
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new ConflictError('Role is already assigned to this membership');
      }
      throw error;
    }
  }

  async removeRole(membershipId: string, roleId: string, tx: Transaction): Promise<void> {
    await tx.query(
      `DELETE FROM membership_roles
       WHERE membership_id = $1 AND role_id = $2`,
      [membershipId, roleId],
      { operation: 'authorization.membership_roles.remove' },
    );
  }

  async listRolesForMembership(membershipId: string, tx: Transaction): Promise<readonly Role[]> {
    const result = await tx.query(
      `SELECT r.id, r.tenant_id, r.name, r.system_key, r.status, r.is_system, r.cloned_from_role_id, r.created_at, r.updated_at
       FROM membership_roles mr
       JOIN roles r ON r.id = mr.role_id
       WHERE mr.membership_id = $1
       ORDER BY r.name ASC`,
      [membershipId],
      { operation: 'authorization.membership_roles.list_roles' },
    );

    return result.rows.map((row) => mapRole(parseOrThrow(roleRowSchema, row, 'role row')));
  }

  async loadPermissionContextByUserAndTenant(
    userId: string,
    tenantId: string,
    tx: Transaction,
  ): Promise<MembershipPermissionContext | null> {
    const result = await tx.query(
      `SELECT id, tenant_id, status
       FROM tenant_memberships
       WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
      { operation: 'authorization.memberships.find_by_user_tenant' },
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = parseOrThrow(membershipRowSchema, result.rows[0], 'membership row');
    return this.loadPermissionContext(row.id, tx);
  }

  async loadPermissionContext(
    membershipId: string,
    tx: Transaction,
  ): Promise<MembershipPermissionContext | null> {
    const membership = await this.findMembership(membershipId, tx);
    if (membership === null) {
      return null;
    }

    const result = await tx.query(
      `SELECT
         r.id AS role_id,
         r.status AS role_status,
         p.key AS permission_key
       FROM membership_roles mr
       JOIN roles r ON r.id = mr.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE mr.membership_id = $1`,
      [membershipId],
      { operation: 'authorization.membership_roles.load_permission_context' },
    );

    const assignments = new Map<string, { roleStatus: Role['status']; keys: Set<string> }>();

    for (const row of result.rows) {
      const roleId = String(row['role_id']);
      const roleStatus = String(row['role_status']) as Role['status'];
      const permissionKey = row['permission_key'];

      const existing = assignments.get(roleId) ?? { roleStatus, keys: new Set<string>() };
      if (typeof permissionKey === 'string') {
        existing.keys.add(permissionKey);
      }
      assignments.set(roleId, existing);
    }

    return {
      membershipStatus: membership.status,
      roleAssignments: [...assignments.entries()].map(([roleId, value]) => ({
        roleId,
        roleStatus: value.roleStatus,
        permissionKeys: [...value.keys].sort(),
      })),
    };
  }

  async lockAdminCapableMemberships(tenantId: string, tx: Transaction): Promise<void> {
    await tx.query(
      `SELECT tm.id
       FROM tenant_memberships tm
       WHERE tm.tenant_id = $1
         AND tm.status = 'ACTIVE'
         AND EXISTS (
           SELECT 1
           FROM membership_roles mr
           JOIN roles r ON r.id = mr.role_id AND r.status = 'ACTIVE'
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE mr.membership_id = tm.id
             AND p.key = $2
         )
       FOR UPDATE OF tm`,
      [tenantId, TENANT_ADMIN_PERMISSION],
      { operation: 'authorization.membership_roles.lock_admin_memberships' },
    );
  }

  async countAdminCapableMemberships(tenantId: string, tx: Transaction): Promise<number> {
    const result = await tx.query(
      `SELECT COUNT(DISTINCT tm.id)::int AS admin_count
       FROM tenant_memberships tm
       WHERE tm.tenant_id = $1
         AND tm.status = 'ACTIVE'
         AND EXISTS (
           SELECT 1
           FROM membership_roles mr
           JOIN roles r ON r.id = mr.role_id AND r.status = 'ACTIVE'
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE mr.membership_id = tm.id
             AND p.key = $2
         )`,
      [tenantId, TENANT_ADMIN_PERMISSION],
      { operation: 'authorization.membership_roles.count_admin_memberships' },
    );

    const count = result.rows[0]?.['admin_count'];
    return typeof count === 'number' ? count : Number(count);
  }

  async membershipHasAdminViaOtherRoles(
    membershipId: string,
    excludingRoleId: string,
    tx: Transaction,
  ): Promise<boolean> {
    const result = await tx.query(
      `SELECT 1
       FROM membership_roles mr
       JOIN roles r ON r.id = mr.role_id AND r.status = 'ACTIVE'
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE mr.membership_id = $1
         AND mr.role_id <> $2
         AND p.key = $3
       LIMIT 1`,
      [membershipId, excludingRoleId, TENANT_ADMIN_PERMISSION],
      { operation: 'authorization.membership_roles.has_admin_via_other_roles' },
    );

    return result.rowCount > 0;
  }
}
