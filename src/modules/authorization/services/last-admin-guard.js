import { BusinessRuleError } from '../../../shared/errors/index.js';
import { TENANT_ADMIN_PERMISSION } from '../models/permission.js';

/**
 * Prevents removing `tenant.admin` from the last active membership that holds
 * it. Uses SELECT FOR UPDATE to serialize concurrent admin changes.
 *
 * @param {{ roles: object, membershipRoles: object }} deps
 * @returns {{ assertCanRemoveRole: Function }}
 */
export function createLastAdminGuard(deps) {
    requireLastAdminGuardDeps(deps);

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

/** @deprecated Prefer {@link createLastAdminGuard}; kept for existing import sites. */
export class LastAdminGuard {
    /**
     * @param {{ roles: object, membershipRoles: object }} deps
     */
    constructor(deps) {
        return createLastAdminGuard(deps);
    }
}

/**
 * @param {object} deps
 */
function requireLastAdminGuardDeps(deps) {
    if (deps === undefined || deps === null || typeof deps !== 'object') {
        throw new Error('createLastAdminGuard requires a deps object');
    }
    for (const name of ['roles', 'membershipRoles']) {
        if (deps[name] === undefined || deps[name] === null) {
            throw new Error(`createLastAdminGuard requires deps.${name}`);
        }
    }
}
