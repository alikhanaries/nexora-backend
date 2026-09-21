import type { AuthorizationService } from '../../authorization/public/index.js';

export function requireOrdersRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'orders.read');
}

export function requireOrdersCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'orders.create');
}

export function requireOrdersUpdate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'orders.update');
}

export function requireOrdersCancel(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'orders.cancel');
}
