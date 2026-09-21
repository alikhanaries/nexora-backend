import type { AuthorizationService } from '../../authorization/public/index.js';

export function requireOffersRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'offers.read');
}

export function requireOffersCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'offers.create');
}

export function requireOffersUpdate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'offers.update');
}
