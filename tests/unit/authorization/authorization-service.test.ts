import { describe, expect, it } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { DefaultAuthorizationService } from '../../../src/modules/authorization/application/authorization-service.js';

describe('DefaultAuthorizationService', () => {
  const authorization = new DefaultAuthorizationService();

  it('checks permissions by key rather than role names', () => {
    const granted = ['orders.read', 'products.read'];

    expect(authorization.hasPermission(granted, 'orders.read')).toBe(true);
    expect(authorization.hasPermission(granted, 'roles.manage')).toBe(false);
  });

  it('throws AuthorizationError when permission is missing', () => {
    expect(() => {
      authorization.requirePermission(['orders.read'], 'users.manage');
    }).toThrow(AuthorizationError);
  });

  it('does not treat role names as permissions', () => {
    expect(authorization.hasPermission(['Administrator'], 'orders.read')).toBe(false);
  });
});
