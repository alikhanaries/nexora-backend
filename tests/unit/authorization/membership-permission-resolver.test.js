import { describe, expect, it, vi } from 'vitest';
import {
    createAuthorizationMembershipPermissionResolver,
    AuthorizationMembershipPermissionResolver,
} from '../../../src/modules/authorization/services/membership-permission-resolver.js';

describe('createAuthorizationMembershipPermissionResolver', () => {
    it('fails fast when membershipRoles is missing', () => {
        expect(() => createAuthorizationMembershipPermissionResolver({}))
            .toThrow('createAuthorizationMembershipPermissionResolver requires deps.membershipRoles');
    });

    it('returns empty permissions when no membership context exists', async () => {
        const membershipRoles = {
            loadPermissionContextByUserAndTenant: vi.fn(async () => null),
        };
        const resolver = createAuthorizationMembershipPermissionResolver({ membershipRoles });
        await expect(resolver.resolvePermissions({}, {
            userId: 'user-1',
            tenantId: 'tenant-1',
        })).resolves.toEqual([]);
    });

    it('resolves effective permissions from membership context', async () => {
        const membershipRoles = {
            loadPermissionContextByUserAndTenant: vi.fn(async () => ({
                membershipStatus: 'ACTIVE',
                roleAssignments: [
                    {
                        roleId: 'role-a',
                        roleStatus: 'ACTIVE',
                        permissionKeys: ['orders.read', 'orders.write'],
                    },
                ],
            })),
        };
        const resolver = createAuthorizationMembershipPermissionResolver({ membershipRoles });
        const permissions = await resolver.resolvePermissions({}, {
            userId: 'user-1',
            tenantId: 'tenant-1',
        });
        expect(permissions).toEqual(expect.arrayContaining(['orders.read', 'orders.write']));
    });

    it('compatibility wrapper accepts membershipRoles directly', async () => {
        const membershipRoles = {
            loadPermissionContextByUserAndTenant: vi.fn(async () => null),
        };
        const resolver = new AuthorizationMembershipPermissionResolver(membershipRoles);
        await expect(resolver.resolvePermissions({}, {
            userId: 'user-1',
            tenantId: 'tenant-1',
        })).resolves.toEqual([]);
    });
});
