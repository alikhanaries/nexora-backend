import type { AuthorizationService } from '../../authorization/public/index.js';
import { TENANT_ADMIN_PERMISSION } from '../../authorization/public/index.js';

export function requireMarketplaceRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  if (
    authorization.hasPermission(permissions, 'marketplaces.read') ||
    authorization.hasPermission(permissions, TENANT_ADMIN_PERMISSION)
  ) {
    return;
  }
  authorization.requirePermission(permissions, 'marketplaces.read');
}

export function requireMarketplaceManage(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  if (
    authorization.hasPermission(permissions, 'marketplaces.manage') ||
    authorization.hasPermission(permissions, TENANT_ADMIN_PERMISSION)
  ) {
    return;
  }
  authorization.requirePermission(permissions, 'marketplaces.manage');
}
