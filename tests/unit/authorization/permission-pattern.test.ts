import { describe, expect, it } from 'vitest';
import {
  expandPermissionPatterns,
  permissionKeyMatchesPattern,
} from '../../../src/modules/authorization/domain/permission-pattern.js';

const catalog = [
  'tenant.admin',
  'orders.read',
  'orders.create',
  'products.read',
  'users.read',
  'users.manage',
  'audit.read',
  'audit.export',
];

describe('permission patterns', () => {
  it('expands prefix patterns for system roles', () => {
    const expanded = expandPermissionPatterns([{ kind: 'prefix', prefix: 'orders' }], catalog);
    expect(expanded).toEqual(['orders.create', 'orders.read']);
  });

  it('expands read-only viewer patterns', () => {
    const expanded = expandPermissionPatterns([{ kind: 'suffix', suffix: '.read' }], catalog);
    expect(expanded).toEqual(['audit.read', 'orders.read', 'products.read', 'users.read']);
  });

  it('expands owner to the full catalog', () => {
    const expanded = expandPermissionPatterns([{ kind: 'all' }], catalog);
    expect(expanded).toEqual([...catalog].sort());
  });

  it('matches exact administrator permissions', () => {
    expect(
      permissionKeyMatchesPattern('tenant.admin', { kind: 'exact', key: 'tenant.admin' }),
    ).toBe(true);
    expect(permissionKeyMatchesPattern('orders.read', { kind: 'exact', key: 'tenant.admin' })).toBe(
      false,
    );
  });
});
