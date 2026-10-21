/**
 * Use case: paginated listing of roles visible to the authenticated tenant.
 */
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ authorization: object, roles: object, database: object }} deps
 * @returns {{ execute: Function }}
 */
export function createListRoles(deps) {
    requireAuthorizationDeps(deps, 'createListRoles', ['authorization', 'roles', 'database']);

    /**
     * @param {object} input
     */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
        return deps.database.execute(async (tx) => {
            const roles = await deps.roles.listByTenant(input.tenantId, tx);
            const withPermissions = [];
            for (const role of roles) {
                const permissions = await deps.roles.listPermissionsForRole(role.id, tx);
                withPermissions.push({
                    ...role,
                    permissionKeys: permissions.map((permission) => permission.key),
                });
            }
            return withPermissions;
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
