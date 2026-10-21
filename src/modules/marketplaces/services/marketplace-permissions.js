import { TENANT_ADMIN_PERMISSION } from '../../authorization/public/index.js';

/** Requires `marketplaces.read` (or tenant admin) for catalog reads. */
export function requireMarketplaceRead(authorization, permissions) {
    if (authorization.hasPermission(permissions, 'marketplaces.read') ||
        authorization.hasPermission(permissions, TENANT_ADMIN_PERMISSION)) {
        return;
    }
    authorization.requirePermission(permissions, 'marketplaces.read');
}

/** Requires `marketplaces.manage` (or tenant admin) for catalog mutations. */
export function requireMarketplaceManage(authorization, permissions) {
    if (authorization.hasPermission(permissions, 'marketplaces.manage') ||
        authorization.hasPermission(permissions, TENANT_ADMIN_PERMISSION)) {
        return;
    }
    authorization.requirePermission(permissions, 'marketplaces.manage');
}
