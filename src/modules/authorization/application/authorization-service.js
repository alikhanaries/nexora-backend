import { AuthorizationError } from '../../../shared/errors/index.js';
import { resolveEffectivePermissions, } from '../domain/effective-permissions.js';
export class DefaultAuthorizationService {
    hasPermission(granted, required) {
        return granted.includes(required);
    }
    requirePermission(granted, required) {
        if (!this.hasPermission(granted, required)) {
            throw new AuthorizationError(`Missing required permission: ${required}`, {
                permission: required,
            });
        }
    }
    resolveFromContext(context) {
        return resolveEffectivePermissions(context);
    }
}
