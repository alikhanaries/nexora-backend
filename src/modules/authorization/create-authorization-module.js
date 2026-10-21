import { createAssignRole } from './services/assign-role.js';
import { createDefaultAuthorizationService } from './services/authorization-service.js';
import { createCreateRole } from './services/create-role.js';
import { createGetEffectivePermissions } from './services/get-effective-permissions.js';
import { createLastAdminGuard } from './services/last-admin-guard.js';
import { createListPermissions } from './services/list-permissions.js';
import { createListRoles } from './services/list-roles.js';
import { createRemoveRole } from './services/remove-role.js';
import { createSystemRoleSeeder } from './services/system-role-seeder.js';
import { PostgresMembershipRoleRepository } from './repositories/postgres-membership-role-repository.js';
import { PostgresPermissionRepository } from './repositories/postgres-permission-repository.js';
import { PostgresRoleRepository } from './repositories/postgres-role-repository.js';
import authorizationRoutes from './views/authorization.routes.js';

export function createAuthorizationModule(deps) {
    requireAuthorizationModuleDeps(deps);
    const authorization = createDefaultAuthorizationService();
    const permissions = new PostgresPermissionRepository(deps.database);
    const roles = new PostgresRoleRepository();
    const membershipRoles = new PostgresMembershipRoleRepository();
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

/**
 * @param {object} deps
 */
function requireAuthorizationModuleDeps(deps) {
    if (deps === undefined || deps === null || typeof deps !== 'object') {
        throw new Error('createAuthorizationModule requires a deps object');
    }
    if (deps.database === undefined || deps.database === null) {
        throw new Error('createAuthorizationModule requires deps.database');
    }
}
