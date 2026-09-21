import type { AuthorizationService } from '../../authorization/public/index.js';

export function requireShipmentsRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'shipments.read');
}

export function requireShipmentsCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'shipments.create');
}

export function requireShipmentsUpdate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'shipments.update');
}
