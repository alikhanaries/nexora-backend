import type { AuthorizationService } from '../../authorization/public/index.js';

export function requirePricingRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'pricing.read');
}

export function requirePricingCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'pricing.create');
}

export function requirePricingUpdate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'pricing.update');
}
