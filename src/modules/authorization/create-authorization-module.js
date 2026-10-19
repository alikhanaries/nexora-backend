import { AssignRole } from './services/assign-role.js';
import { DefaultAuthorizationService } from './services/authorization-service.js';
import { CreateRole } from './services/create-role.js';
import { GetEffectivePermissions } from './services/get-effective-permissions.js';
import { LastAdminGuard } from './services/last-admin-guard.js';
import { ListPermissions } from './services/list-permissions.js';
import { ListRoles } from './services/list-roles.js';
import { RemoveRole } from './services/remove-role.js';
import { SystemRoleSeeder } from './services/system-role-seeder.js';
import { PostgresMembershipRoleRepository } from './repositories/postgres-membership-role-repository.js';
import { PostgresPermissionRepository } from './repositories/postgres-permission-repository.js';
import { PostgresRoleRepository } from './repositories/postgres-role-repository.js';
import authorizationRoutes from './views/authorization.routes.js';
export function createAuthorizationModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const permissions = new PostgresPermissionRepository(deps.database);
    const roles = new PostgresRoleRepository();
    const membershipRoles = new PostgresMembershipRoleRepository();
    const lastAdminGuard = new LastAdminGuard({ roles, membershipRoles });
    const createRole = new CreateRole({ authorization, roles, database: deps.database });
    const listRoles = new ListRoles({ authorization, roles, database: deps.database });
    const assignRole = new AssignRole({
        authorization,
        roles,
        membershipRoles,
        database: deps.database,
    });
    const removeRole = new RemoveRole({
        authorization,
        roles,
        membershipRoles,
        lastAdminGuard,
        database: deps.database,
    });
    const listPermissions = new ListPermissions({ authorization, permissions });
    const getEffectivePermissions = new GetEffectivePermissions({
        authorization,
        membershipRoles,
        database: deps.database,
    });
    const systemRoleSeeder = new SystemRoleSeeder({
        permissions,
        roles,
        database: deps.database,
    });
    const routes = authorizationRoutes;
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
        routes: {
            plugin: routes,
            options: {
                createRole,
                listRoles,
                assignRole,
                removeRole,
                listPermissions,
                getEffectivePermissions,
            },
        },
    };
}
