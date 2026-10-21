import { resolveEffectivePermissions } from '../models/effective-permissions.js';

/**
 * @param {{ membershipRoles: object }} deps
 * @returns {{ resolvePermissions: Function }}
 */
export function createAuthorizationMembershipPermissionResolver(deps) {
    const membershipRoles = deps?.membershipRoles;
    if (membershipRoles === undefined || membershipRoles === null) {
        throw new Error('createAuthorizationMembershipPermissionResolver requires deps.membershipRoles');
    }

    /**
     * @param {object} tx
     * @param {{ userId: string, tenantId: string }} input
     */
    async function resolvePermissions(tx, input) {
        const context = await membershipRoles.loadPermissionContextByUserAndTenant(input.userId, input.tenantId, tx);
        if (context === null) {
            return [];
        }
        return resolveEffectivePermissions(context);
    }

    return { resolvePermissions };
}

/**
 * @deprecated Prefer {@link createAuthorizationMembershipPermissionResolver}; kept for existing import sites.
 * Constructor continues to accept the repository directly (historical call sites).
 */
export class AuthorizationMembershipPermissionResolver {
    /**
     * @param {object} membershipRoles
     */
    constructor(membershipRoles) {
        return createAuthorizationMembershipPermissionResolver({ membershipRoles });
    }
}
