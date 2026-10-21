/**
 * Use case: define a new tenant-scoped role and its permission set.
 */
import { ConflictError, ValidationError } from '../../../shared/errors/index.js';
import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ authorization: object, roles: object, database: object }} deps
 * @returns {{ execute: Function }}
 */
export function createCreateRole(deps) {
    requireAuthorizationDeps(deps, 'createCreateRole', ['authorization', 'roles', 'database']);

    /**
     * @param {object} input
     */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Role name is required');
        }
        if (input.permissionKeys.length === 0) {
            throw new ValidationError('At least one permission is required');
        }
        return deps.database.execute(async (tx) => {
            const existing = await deps.roles.findByTenantAndName(input.tenantId, name, tx);
            if (existing !== null) {
                throw new ConflictError('A role with this name already exists in the tenant', {
                    name,
                });
            }
            return deps.roles.create({
                tenantId: input.tenantId,
                name,
                permissionKeys: input.permissionKeys,
                isSystem: false,
                systemKey: null,
            }, tx);
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
