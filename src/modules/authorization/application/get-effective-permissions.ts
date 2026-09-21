import { NotFoundError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { MembershipRoleRepository } from '../domain/ports/membership-role-repository.js';
import type { AuthorizationService } from './authorization-service.js';

export interface GetEffectivePermissionsInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly membershipId: string;
}

export interface GetEffectivePermissionsResult {
  readonly membershipId: string;
  readonly permissions: readonly string[];
}

export interface GetEffectivePermissionsDependencies {
  readonly authorization: AuthorizationService;
  readonly membershipRoles: MembershipRoleRepository;
  readonly database: TransactionManager;
}

export class GetEffectivePermissions {
  constructor(private readonly deps: GetEffectivePermissionsDependencies) {}

  async execute(input: GetEffectivePermissionsInput): Promise<GetEffectivePermissionsResult> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'roles.read');

    return this.deps.database.execute(
      async (tx) => {
        const context = await this.deps.membershipRoles.loadPermissionContext(
          input.membershipId,
          tx,
        );
        if (context === null) {
          throw new NotFoundError('Membership was not found');
        }

        const permissions = this.deps.authorization.resolveFromContext(context);
        return {
          membershipId: input.membershipId,
          permissions,
        };
      },
      { tenantId: input.tenantId },
    );
  }
}
