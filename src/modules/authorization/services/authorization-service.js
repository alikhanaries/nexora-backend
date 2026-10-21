/**
 * Pure RBAC helpers: permission checks and resolving granted permissions from request context.
 */
import { AuthorizationError } from '../../../shared/errors/index.js';
import { resolveEffectivePermissions, } from '../models/effective-permissions.js';

/**
 * Factory for in-process permission checks used by use cases and HTTP layers.
 * @returns {{
 *   hasPermission: (granted: string[], required: string) => boolean,
 *   requirePermission: (granted: string[], required: string) => void,
 *   resolveFromContext: (context: object) => string[],
 * }}
 */
export function createDefaultAuthorizationService() {
    /** @param {string[]} granted @param {string} required */
    function hasPermission(granted, required) {
        return granted.includes(required);
    }

    /** Throws {@link AuthorizationError} when `required` is not in `granted`. */
    function requirePermission(granted, required) {
        if (!hasPermission(granted, required)) {
            throw new AuthorizationError(`Missing required permission: ${required}`, {
                permission: required,
            });
        }
    }

    /** Derives flat permission keys from RBAC context (membership roles + status). */
    function resolveFromContext(context) {
        return resolveEffectivePermissions(context);
    }

    return {
        hasPermission,
        requirePermission,
        resolveFromContext,
    };
}
