import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { MembershipRoleRepository } from '../domain/ports/membership-role-repository.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { AuthorizationService } from './authorization-service.js';
import type { LastAdminGuard } from './last-admin-guard.js';

export interface RemoveRoleInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly membershipId: string;
  readonly roleId: string;
}

export interface RemoveRoleDependencies {
  readonly authorization: AuthorizationService;
  readonly roles: RoleRepository;
  readonly membershipRoles: MembershipRoleRepository;
  readonly lastAdminGuard: LastAdminGuard;
  readonly database: TransactionManager;
}

export class RemoveRole {
  constructor(private readonly deps: RemoveRoleDependencies) {}

  async execute(input: RemoveRoleInput): Promise<void> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');

    await this.deps.database.execute(
      async (tx) => {
        const membership = await this.deps.membershipRoles.findMembership(input.membershipId, tx);
        if (membership === null || membership.tenantId !== input.tenantId) {
          throw new NotFoundError('Membership was not found');
        }
        if (membership.status !== 'ACTIVE') {
          throw new ValidationError('Roles can only be removed from active memberships');
        }

        const role = await this.deps.roles.findById(input.roleId, tx);
        if (role === null || role.tenantId !== input.tenantId) {
          throw new NotFoundError('Role was not found');
        }

        const assigned = await this.deps.membershipRoles.listRolesForMembership(
          input.membershipId,
          tx,
        );
        if (!assigned.some((entry) => entry.id === input.roleId)) {
          throw new NotFoundError('Role is not assigned to this membership');
        }

        await this.deps.lastAdminGuard.assertCanRemoveRole(
          input.tenantId,
          input.membershipId,
          input.roleId,
          tx,
        );

        await this.deps.membershipRoles.removeRole(input.membershipId, input.roleId, tx);
      },
      { tenantId: input.tenantId },
    );
  }
}
