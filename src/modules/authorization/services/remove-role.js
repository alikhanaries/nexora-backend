/**
 * Use case: detach a role from a membership, guarded by {@link createLastAdminGuard}.
 */
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ authorization: object, roles: object, membershipRoles: object, lastAdminGuard: object, database: object }} deps
 * @returns {{ execute: Function }}
 */
export function createRemoveRole(deps) {
    requireAuthorizationDeps(deps, 'createRemoveRole', [
        'authorization',
        'roles',
        'membershipRoles',
        'lastAdminGuard',
        'database',
    ]);

    /**
     * @param {object} input
     */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');
        await deps.database.execute(async (tx) => {
            const membership = await deps.membershipRoles.findMembership(input.membershipId, tx);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            if (membership.status !== 'ACTIVE') {
                throw new ValidationError('Roles can only be removed from active memberships');
            }
            const role = await deps.roles.findById(input.roleId, tx);
            if (role === null || role.tenantId !== input.tenantId) {
                throw new NotFoundError('Role was not found');
            }
            const assigned = await deps.membershipRoles.listRolesForMembership(input.membershipId, tx);
            if (!assigned.some((entry) => entry.id === input.roleId)) {
                throw new NotFoundError('Role is not assigned to this membership');
            }
            await deps.lastAdminGuard.assertCanRemoveRole(input.tenantId, input.membershipId, input.roleId, tx);
            await deps.membershipRoles.removeRole(input.membershipId, input.roleId, tx);
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
