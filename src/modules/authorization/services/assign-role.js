/**
 * Use case: attach a tenant role to a membership (RBAC assignment command).
 */
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ authorization: object, roles: object, membershipRoles: object, database: object }} deps
 * @returns {{ execute: Function }}
 */
export function createAssignRole(deps) {
    requireAuthorizationDeps(deps, 'createAssignRole', ['authorization', 'roles', 'membershipRoles', 'database']);

    /**
     * @param {object} input
     */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');
        return deps.database.execute(async (tx) => {
            const membership = await deps.membershipRoles.findMembership(input.membershipId, tx);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            if (membership.status !== 'ACTIVE') {
                throw new ValidationError('Roles can only be assigned to active memberships');
            }
            const role = await deps.roles.findById(input.roleId, tx);
            if (role === null || role.tenantId !== input.tenantId) {
                throw new NotFoundError('Role was not found');
            }
            if (role.status !== 'ACTIVE') {
                throw new ValidationError('Inactive roles cannot be assigned');
            }
            const assigned = await deps.membershipRoles.listRolesForMembership(input.membershipId, tx);
            if (assigned.some((entry) => entry.id === input.roleId)) {
                throw new ConflictError('Role is already assigned to this membership');
            }
            await deps.membershipRoles.assignRole(input.membershipId, input.roleId, tx);
            const permissions = await deps.roles.listPermissionsForRole(role.id, tx);
            return {
                ...role,
                permissionKeys: permissions.map((permission) => permission.key),
            };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
