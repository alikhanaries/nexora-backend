import type { RoleStatus } from './role.js';

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface RolePermissionAssignment {
  readonly roleId: string;
  readonly roleStatus: RoleStatus;
  readonly permissionKeys: readonly string[];
}

export interface MembershipPermissionContext {
  readonly membershipStatus: MembershipStatus;
  readonly roleAssignments: readonly RolePermissionAssignment[];
}

/**
 * Resolves effective permissions as the union of all ACTIVE roles on an ACTIVE
 * membership. Inactive roles and non-active memberships yield no permissions.
 */
export function resolveEffectivePermissions(
  context: MembershipPermissionContext,
): readonly string[] {
  if (context.membershipStatus !== 'ACTIVE') {
    return [];
  }

  const granted = new Set<string>();

  for (const assignment of context.roleAssignments) {
    if (assignment.roleStatus !== 'ACTIVE') {
      continue;
    }

    for (const key of assignment.permissionKeys) {
      granted.add(key);
    }
  }

  return [...granted].sort();
}
