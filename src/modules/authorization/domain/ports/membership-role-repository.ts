import type { Transaction } from '../../../../shared/persistence/index.js';
import type { MembershipPermissionContext } from '../effective-permissions.js';
import type { Role } from '../role.js';

export interface MembershipSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly status: MembershipPermissionContext['membershipStatus'];
}

export interface MembershipRoleRepository {
  findMembership(membershipId: string, tx: Transaction): Promise<MembershipSummary | null>;
  assignRole(membershipId: string, roleId: string, tx: Transaction): Promise<void>;
  removeRole(membershipId: string, roleId: string, tx: Transaction): Promise<void>;
  listRolesForMembership(membershipId: string, tx: Transaction): Promise<readonly Role[]>;
  loadPermissionContext(
    membershipId: string,
    tx: Transaction,
  ): Promise<MembershipPermissionContext | null>;
  loadPermissionContextByUserAndTenant(
    userId: string,
    tenantId: string,
    tx: Transaction,
  ): Promise<MembershipPermissionContext | null>;
  lockAdminCapableMemberships(tenantId: string, tx: Transaction): Promise<void>;
  countAdminCapableMemberships(tenantId: string, tx: Transaction): Promise<number>;
  membershipHasAdminViaOtherRoles(
    membershipId: string,
    excludingRoleId: string,
    tx: Transaction,
  ): Promise<boolean>;
}
