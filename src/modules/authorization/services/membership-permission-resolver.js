/**
 * Resolves membership → permission strings for auth (login, JWT refresh, API checks).
 */
import { resolveEffectivePermissions } from '../models/effective-permissions.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ membershipRoles: object }} deps
 * @returns {{ resolvePermissions: Function }}
 */
export function createAuthorizationMembershipPermissionResolver(deps) {
    requireAuthorizationDeps(deps, 'createAuthorizationMembershipPermissionResolver', ['membershipRoles']);
    const { membershipRoles } = deps;

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
