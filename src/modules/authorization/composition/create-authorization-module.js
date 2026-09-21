import { AssignRole } from '../application/assign-role.js';
import { DefaultAuthorizationService } from '../application/authorization-service.js';
import { CreateRole } from '../application/create-role.js';
import { GetEffectivePermissions } from '../application/get-effective-permissions.js';
import { LastAdminGuard } from '../application/last-admin-guard.js';
import { ListPermissions } from '../application/list-permissions.js';
import { ListRoles } from '../application/list-roles.js';
import { RemoveRole } from '../application/remove-role.js';
import { SystemRoleSeeder } from '../application/system-role-seeder.js';
import { PostgresMembershipRoleRepository } from '../infrastructure/postgres-membership-role-repository.js';
import { PostgresPermissionRepository } from '../infrastructure/postgres-permission-repository.js';
import { PostgresRoleRepository } from '../infrastructure/postgres-role-repository.js';
import authorizationRoutes from '../presentation/authorization.routes.js';
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
