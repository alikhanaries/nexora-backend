import { describe, expect, it, vi } from 'vitest';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';
import { LastAdminGuard } from '../../../src/modules/authorization/application/last-admin-guard.js';
const tx = {};
function createGuard(overrides) {
    const roles = {
        create: vi.fn(),
        findById: vi.fn(),
        findByTenantAndName: vi.fn(),
        findSystemRoleByKey: vi.fn(),
        listByTenant: vi.fn(),
        listPermissionsForRole: vi.fn(),
        roleGrantsPermission: vi.fn(async () => overrides.grantsAdmin ?? true),
        setRolePermissions: vi.fn(),
    };
    const lockAdminCapableMemberships = vi.fn(async () => undefined);
    const membershipRoles = {
        findMembership: vi.fn(),
        assignRole: vi.fn(),
        removeRole: vi.fn(),
        listRolesForMembership: vi.fn(),
        loadPermissionContext: vi.fn(),
        loadPermissionContextByUserAndTenant: vi.fn(),
        lockAdminCapableMemberships,
        countAdminCapableMemberships: vi.fn(async () => overrides.adminMembershipCount ?? 1),
        membershipHasAdminViaOtherRoles: vi.fn(async () => overrides.hasAdminViaOtherRoles ?? false),
    };
    return {
        guard: new LastAdminGuard({ roles, membershipRoles }),
        lockAdminCapableMemberships,
        membershipRoles,
        roles,
    };
}
describe('LastAdminGuard', () => {
    it('allows removing a role that does not grant tenant.admin', async () => {
        const { guard } = createGuard({ grantsAdmin: false });
        await expect(guard.assertCanRemoveRole('tenant-1', 'membership-1', 'role-1', tx)).resolves.toBeUndefined();
    });
    it('allows removing admin when membership retains admin via another role', async () => {
        const { guard } = createGuard({
            grantsAdmin: true,
            adminMembershipCount: 1,
            hasAdminViaOtherRoles: true,
        });
        await expect(guard.assertCanRemoveRole('tenant-1', 'membership-1', 'role-1', tx)).resolves.toBeUndefined();
    });
    it('blocks removing the last admin-capable membership role', async () => {
        const { guard, lockAdminCapableMemberships } = createGuard({
            grantsAdmin: true,
            adminMembershipCount: 1,
            hasAdminViaOtherRoles: false,
        });
        await expect(guard.assertCanRemoveRole('tenant-1', 'membership-1', 'role-1', tx)).rejects.toBeInstanceOf(BusinessRuleError);
        expect(lockAdminCapableMemberships).toHaveBeenCalledWith('tenant-1', tx);
    });
    it('allows removing admin when another membership still has tenant.admin', async () => {
        const { guard } = createGuard({
            grantsAdmin: true,
            adminMembershipCount: 2,
            hasAdminViaOtherRoles: false,
        });
        await expect(guard.assertCanRemoveRole('tenant-1', 'membership-1', 'role-1', tx)).resolves.toBeUndefined();
    });
});
