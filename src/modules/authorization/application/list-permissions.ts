import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { Permission } from '../domain/permission.js';
import type { AuthorizationService } from './authorization-service.js';

export interface ListPermissionsInput {
  readonly actorPermissions: readonly string[];
}

export interface ListPermissionsDependencies {
  readonly authorization: AuthorizationService;
  readonly permissions: PermissionRepository;
}

export class ListPermissions {
  constructor(private readonly deps: ListPermissionsDependencies) {}

  async execute(input: ListPermissionsInput): Promise<readonly Permission[]> {
    this.deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
    return this.deps.permissions.listAll();
  }
}
