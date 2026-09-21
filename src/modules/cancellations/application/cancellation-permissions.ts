import type { AuthorizationService } from '../../authorization/public/index.js';

export function requireCancellationsRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'cancellations.read');
}

export function requireCancellationsCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'cancellations.create');
}

export function requireOrdersCancel(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'orders.cancel');
}
