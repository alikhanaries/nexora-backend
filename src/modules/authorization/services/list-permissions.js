import { requireAuthorizationDeps } from './require-deps.js';

/**
 * @param {{ authorization: object, permissions: object }} deps
 * @returns {{ execute: Function }}
 */
export function createListPermissions(deps) {
    requireAuthorizationDeps(deps, 'createListPermissions', ['authorization', 'permissions']);

    /**
     * @param {object} input
     */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
        return deps.permissions.listAll();
    }

    return { execute };
}
