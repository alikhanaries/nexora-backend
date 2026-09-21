import { describe, expect, it } from 'vitest';
import { resolveEffectivePermissions } from '../../../src/modules/authorization/domain/effective-permissions.js';

describe('resolveEffectivePermissions', () => {
  it('returns the union of permissions from all active roles', () => {
    const permissions = resolveEffectivePermissions({
      membershipStatus: 'ACTIVE',
      roleAssignments: [
        {
          roleId: 'role-a',
          roleStatus: 'ACTIVE',
          permissionKeys: ['orders.read', 'products.read'],
        },
        {
          roleId: 'role-b',
          roleStatus: 'ACTIVE',
          permissionKeys: ['orders.create', 'orders.read'],
        },
      ],
    });

    expect(permissions).toEqual(['orders.create', 'orders.read', 'products.read']);
  });

  it('excludes permissions from inactive roles', () => {
    const permissions = resolveEffectivePermissions({
      membershipStatus: 'ACTIVE',
      roleAssignments: [
        {
          roleId: 'role-a',
          roleStatus: 'ACTIVE',
          permissionKeys: ['orders.read'],
        },
        {
          roleId: 'role-b',
          roleStatus: 'INACTIVE',
          permissionKeys: ['orders.create'],
        },
      ],
    });

    expect(permissions).toEqual(['orders.read']);
  });

  it('returns no permissions for inactive memberships', () => {
    const permissions = resolveEffectivePermissions({
      membershipStatus: 'SUSPENDED',
      roleAssignments: [
        {
          roleId: 'role-a',
          roleStatus: 'ACTIVE',
          permissionKeys: ['orders.read'],
        },
      ],
    });

    expect(permissions).toEqual([]);
  });

  it('returns no permissions for revoked memberships', () => {
    const permissions = resolveEffectivePermissions({
      membershipStatus: 'REVOKED',
      roleAssignments: [
        {
          roleId: 'role-a',
          roleStatus: 'ACTIVE',
          permissionKeys: ['tenant.admin'],
        },
      ],
    });

    expect(permissions).toEqual([]);
  });
});
