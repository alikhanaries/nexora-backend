import { ConflictError, ValidationError } from '../../../shared/errors/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { RoleWithPermissions } from '../domain/role.js';
import type { AuthorizationService } from './authorization-service.js';

export interface CreateRoleInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly name: string;
  readonly permissionKeys: readonly string[];
}

export interface CreateRoleDependencies {
  readonly authorization: AuthorizationService;
  readonly roles: RoleRepository;
  readonly database: TransactionManager;
}

export class CreateRole {
  constructor(private readonly deps: CreateRoleDependencies) {}

  async execute(input: CreateRoleInput): Promise<RoleWithPermissions> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');

    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Role name is required');
    }
    if (input.permissionKeys.length === 0) {
      throw new ValidationError('At least one permission is required');
    }

    return this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.roles.findByTenantAndName(input.tenantId, name, tx);
        if (existing !== null) {
          throw new ConflictError('A role with this name already exists in the tenant', {
            name,
          });
        }

        return this.deps.roles.create(
          {
            tenantId: input.tenantId,
            name,
            permissionKeys: input.permissionKeys,
            isSystem: false,
            systemKey: null,
          },
          tx,
        );
      },
      { tenantId: input.tenantId },
    );
  }
}
