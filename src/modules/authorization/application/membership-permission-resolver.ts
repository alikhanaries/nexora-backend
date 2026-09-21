import { resolveEffectivePermissions } from '../domain/effective-permissions.js';
import type { MembershipRoleRepository } from '../domain/ports/membership-role-repository.js';
import type { MembershipPermissionResolver } from '../../../shared/auth/index.js';
import type { Transaction } from '../../../shared/persistence/index.js';

export class AuthorizationMembershipPermissionResolver implements MembershipPermissionResolver {
  constructor(private readonly membershipRoles: MembershipRoleRepository) {}

  async resolvePermissions(
    tx: Transaction,
    input: { readonly userId: string; readonly tenantId: string },
  ): Promise<readonly string[]> {
    const context = await this.membershipRoles.loadPermissionContextByUserAndTenant(
      input.userId,
      input.tenantId,
      tx,
    );
    if (context === null) {
      return [];
    }
    return resolveEffectivePermissions(context);
  }
}
