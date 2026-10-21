import { BusinessRuleError } from '../../../shared/errors/index.js';
import { TENANT_ADMIN_PERMISSION } from '../models/permission.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * Prevents removing `tenant.admin` from the last active membership that holds
 * it. Uses SELECT FOR UPDATE to serialize concurrent admin changes.
 *
 * @param {{ roles: object, membershipRoles: object }} deps
 * @returns {{ assertCanRemoveRole: Function }}
 */
export function createLastAdminGuard(deps) {
    requireAuthorizationDeps(deps, 'createLastAdminGuard', ['roles', 'membershipRoles']);

    /**
     * @param {string} tenantId
     * @param {string} membershipId
     * @param {string} roleId
     * @param {object} tx
     */
    async function assertCanRemoveRole(tenantId, membershipId, roleId, tx) {
        const grantsAdmin = await deps.roles.roleGrantsPermission(roleId, TENANT_ADMIN_PERMISSION, tx);
        if (!grantsAdmin) {
            return;
        }
        await deps.membershipRoles.lockAdminCapableMemberships(tenantId, tx);
        const stillHasAdminViaOtherRoles = await deps.membershipRoles.membershipHasAdminViaOtherRoles(membershipId, roleId, tx);
        if (stillHasAdminViaOtherRoles) {
            return;
        }
        const adminMembershipCount = await deps.membershipRoles.countAdminCapableMemberships(tenantId, tx);
        if (adminMembershipCount <= 1) {
            throw new BusinessRuleError('Cannot remove the last active membership with tenant administration capability', { permission: TENANT_ADMIN_PERMISSION });
        }
    }

    return { assertCanRemoveRole };
}
