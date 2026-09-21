import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { RoleWithPermissions } from '../domain/role.js';
import type { AuthorizationService } from './authorization-service.js';

export interface ListRolesInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
}

export interface ListRolesDependencies {
  readonly authorization: AuthorizationService;
  readonly roles: RoleRepository;
  readonly database: TransactionManager;
}

export class ListRoles {
  constructor(private readonly deps: ListRolesDependencies) {}

  async execute(input: ListRolesInput): Promise<readonly RoleWithPermissions[]> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'roles.read');

    return this.deps.database.execute(
      async (tx) => {
        const roles = await this.deps.roles.listByTenant(input.tenantId, tx);
        const withPermissions: RoleWithPermissions[] = [];

        for (const role of roles) {
          const permissions = await this.deps.roles.listPermissionsForRole(role.id, tx);
          withPermissions.push({
            ...role,
            permissionKeys: permissions.map((permission) => permission.key),
          });
        }

        return withPermissions;
      },
      { tenantId: input.tenantId },
    );
  }
}
