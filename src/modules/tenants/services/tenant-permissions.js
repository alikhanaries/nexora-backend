import { AuthorizationError } from '../../../shared/errors/index.js';
import { TENANT_ADMIN_PERMISSION } from '../../authorization/public/index.js';

/**
 * Ensures lifecycle mutations target the authenticated tenant and require
 * tenant administration permission.
 */
export function requireTenantLifecycleAccess(authorization, actorTenantId, targetTenantId, actorPermissions) {
    if (actorTenantId !== targetTenantId) {
        throw new AuthorizationError('Operation is not permitted for this tenant', {
            actorTenantId,
            targetTenantId,
        });
    }
    authorization.requirePermission(actorPermissions, TENANT_ADMIN_PERMISSION);
}
