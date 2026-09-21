import type { AuthorizationService } from '../../authorization/public/index.js';

export function requireReturnsRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'returns.read');
}

export function requireReturnsCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'returns.create');
}

export function requireReturnsUpdate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'returns.update');
}
