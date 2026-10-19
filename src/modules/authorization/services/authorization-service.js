import { AuthorizationError } from '../../../shared/errors/index.js';
import { resolveEffectivePermissions, } from '../models/effective-permissions.js';

/**
 * @returns {{
 *   hasPermission: (granted: string[], required: string) => boolean,
 *   requirePermission: (granted: string[], required: string) => void,
 *   resolveFromContext: (context: object) => string[],
 * }}
 */
export function createDefaultAuthorizationService() {
    function hasPermission(granted, required) {
        return granted.includes(required);
    }

    function requirePermission(granted, required) {
        if (!hasPermission(granted, required)) {
            throw new AuthorizationError(`Missing required permission: ${required}`, {
                permission: required,
            });
        }
    }

    function resolveFromContext(context) {
        return resolveEffectivePermissions(context);
    }

    return {
        hasPermission,
        requirePermission,
        resolveFromContext,
    };
}

/** @deprecated Prefer {@link createDefaultAuthorizationService}; kept for existing import sites. */
export class DefaultAuthorizationService {
    constructor() {
        return createDefaultAuthorizationService();
    }
}
