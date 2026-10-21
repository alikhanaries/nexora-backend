import { NotFoundError } from '../../../shared/errors/index.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ authorization: object, membershipRoles: object, database: object }} deps
 * @returns {{ execute: Function }}
 */
export function createGetEffectivePermissions(deps) {
    requireAuthorizationDeps(deps, 'createGetEffectivePermissions', [
        'authorization',
        'membershipRoles',
        'database',
    ]);

    /**
     * @param {object} input
     */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
        return deps.database.execute(async (tx) => {
            const context = await deps.membershipRoles.loadPermissionContext(input.membershipId, tx);
            if (context === null) {
                throw new NotFoundError('Membership was not found');
            }
            const permissions = deps.authorization.resolveFromContext(context);
            return {
                membershipId: input.membershipId,
                permissions,
            };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}

/** @deprecated Prefer {@link createGetEffectivePermissions}; kept for existing import sites. */
export class GetEffectivePermissions {
    /**
     * @param {object} deps
     */
    constructor(deps) {
        return createGetEffectivePermissions(deps);
    }
}
