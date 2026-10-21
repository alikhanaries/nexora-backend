import { createAssignRole } from './services/assign-role.js';
import { createDefaultAuthorizationService } from './services/authorization-service.js';
import { createCreateRole } from './services/create-role.js';
import { createGetEffectivePermissions } from './services/get-effective-permissions.js';
import { createLastAdminGuard } from './services/last-admin-guard.js';
import { createListPermissions } from './services/list-permissions.js';
import { createListRoles } from './services/list-roles.js';
import { createRemoveRole } from './services/remove-role.js';
import { requireAuthorizationDeps } from './services/require-deps.js';
import { createSystemRoleSeeder } from './services/system-role-seeder.js';
import { createPostgresMembershipRoleRepository } from './repositories/postgres-membership-role-repository.js';
import { createPostgresPermissionRepository } from './repositories/postgres-permission-repository.js';
import { createPostgresRoleRepository } from './repositories/postgres-role-repository.js';

export function createAuthorizationModule(deps) {
    requireAuthorizationDeps(deps, 'createAuthorizationModule', ['database']);
    const authorization = createDefaultAuthorizationService();
    const permissions = createPostgresPermissionRepository(deps.database);
    const roles = createPostgresRoleRepository();
    const membershipRoles = createPostgresMembershipRoleRepository();
    const lastAdminGuard = createLastAdminGuard({ roles, membershipRoles });
    const createRole = createCreateRole({ authorization, roles, database: deps.database });
    const listRoles = createListRoles({ authorization, roles, database: deps.database });
    const assignRole = createAssignRole({
        authorization,
        roles,
        membershipRoles,
        database: deps.database,
    });
    const removeRole = createRemoveRole({
        authorization,
        roles,
        membershipRoles,
        lastAdminGuard,
        database: deps.database,
    });
    const listPermissions = createListPermissions({ authorization, permissions });
    const getEffectivePermissions = createGetEffectivePermissions({
        authorization,
        membershipRoles,
        database: deps.database,
    });
    const systemRoleSeeder = createSystemRoleSeeder({
        permissions,
        roles,
        database: deps.database,
    });
    return {
        authorizationService: authorization,
        useCases: {
            createRole,
            listRoles,
            assignRole,
            removeRole,
            listPermissions,
            getEffectivePermissions,
            systemRoleSeeder,
        },
    };
}
