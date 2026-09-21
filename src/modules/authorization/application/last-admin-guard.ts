import { BusinessRuleError } from '../../../shared/errors/index.js';
import { TENANT_ADMIN_PERMISSION } from '../domain/permission.js';
import type { MembershipRoleRepository } from '../domain/ports/membership-role-repository.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { Transaction } from '../../../shared/persistence/index.js';

export interface LastAdminGuardDependencies {
  readonly roles: RoleRepository;
  readonly membershipRoles: MembershipRoleRepository;
}

/**
 * Prevents removing `tenant.admin` from the last active membership that holds
 * it. Uses SELECT FOR UPDATE to serialize concurrent admin changes.
 */
export class LastAdminGuard {
  constructor(private readonly deps: LastAdminGuardDependencies) {}

  async assertCanRemoveRole(
    tenantId: string,
    membershipId: string,
    roleId: string,
    tx: Transaction,
  ): Promise<void> {
    const grantsAdmin = await this.deps.roles.roleGrantsPermission(
      roleId,
      TENANT_ADMIN_PERMISSION,
      tx,
    );
    if (!grantsAdmin) {
      return;
    }

    await this.deps.membershipRoles.lockAdminCapableMemberships(tenantId, tx);

    const stillHasAdminViaOtherRoles =
      await this.deps.membershipRoles.membershipHasAdminViaOtherRoles(membershipId, roleId, tx);
    if (stillHasAdminViaOtherRoles) {
      return;
    }

    const adminMembershipCount = await this.deps.membershipRoles.countAdminCapableMemberships(
      tenantId,
      tx,
    );
    if (adminMembershipCount <= 1) {
      throw new BusinessRuleError(
        'Cannot remove the last active membership with tenant administration capability',
        { permission: TENANT_ADMIN_PERMISSION },
      );
    }
  }
}
