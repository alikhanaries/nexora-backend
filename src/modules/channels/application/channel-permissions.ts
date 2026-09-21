import type { AuthorizationService } from '../../authorization/public/index.js';

export function requireChannelRead(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'channels.read');
}

export function requireChannelCreate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'channels.create');
}

export function requireChannelUpdate(
  authorization: AuthorizationService,
  permissions: readonly string[],
): void {
  authorization.requirePermission(permissions, 'channels.update');
}
