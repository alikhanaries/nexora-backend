import { AuthorizationError } from '../../../shared/errors/index.js';
import {
  resolveEffectivePermissions,
  type MembershipPermissionContext,
} from '../domain/effective-permissions.js';

export interface PermissionChecker {
  hasPermission(granted: readonly string[], required: string): boolean;
  requirePermission(granted: readonly string[], required: string): void;
}

export interface AuthorizationService extends PermissionChecker {
  resolveFromContext(context: MembershipPermissionContext): readonly string[];
}

export class DefaultAuthorizationService implements AuthorizationService {
  hasPermission(granted: readonly string[], required: string): boolean {
    return granted.includes(required);
  }

  requirePermission(granted: readonly string[], required: string): void {
    if (!this.hasPermission(granted, required)) {
      throw new AuthorizationError(`Missing required permission: ${required}`, {
        permission: required,
      });
    }
  }

  resolveFromContext(context: MembershipPermissionContext): readonly string[] {
    return resolveEffectivePermissions(context);
  }
}
