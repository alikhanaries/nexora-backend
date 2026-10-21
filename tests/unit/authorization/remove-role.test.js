import { describe, expect, it, vi } from 'vitest';
import {
    AuthorizationError,
    BusinessRuleError,
    NotFoundError,
} from '../../../src/shared/errors/index.js';
import {
    createRemoveRole,
    RemoveRole,
} from '../../../src/modules/authorization/services/remove-role.js';
import { createDefaultAuthorizationService } from '../../../src/modules/authorization/services/authorization-service.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const MEMBERSHIP_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_ID = '44444444-4444-4444-8444-444444444444';

function createDeps(overrides = {}) {
    return {
        authorization: createDefaultAuthorizationService(),
        database: {
            execute: vi.fn(async (work) => work({})),
        },
        roles: {
            findById: vi.fn(async () => overrides.role ?? {
                id: ROLE_ID,
                tenantId: TENANT_A,
                status: 'ACTIVE',
            }),
        },
        membershipRoles: {
            findMembership: vi.fn(async () => overrides.membership ?? {
                id: MEMBERSHIP_ID,
                tenantId: TENANT_A,
                status: 'ACTIVE',
            }),
            listRolesForMembership: vi.fn(async () => overrides.assigned ?? [{ id: ROLE_ID }]),
            removeRole: vi.fn(async () => undefined),
        },
        lastAdminGuard: {
            assertCanRemoveRole: overrides.assertCanRemoveRole
                ?? vi.fn(async () => undefined),
        },
    };
}

describe('createRemoveRole', () => {
    it('fails fast when lastAdminGuard is missing', () => {
        expect(() => createRemoveRole({
            authorization: {},
            roles: {},
            membershipRoles: {},
            database: {},
        })).toThrow('createRemoveRole requires deps.lastAdminGuard');
    });

    it('denies actors without roles.manage', async () => {
        const deps = createDeps();
        const useCase = createRemoveRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: [],
        })).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('denies cross-tenant membership removal', async () => {
        const deps = createDeps({
            membership: { id: MEMBERSHIP_ID, tenantId: TENANT_B, status: 'ACTIVE' },
        });
        const useCase = createRemoveRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(NotFoundError);
        expect(deps.membershipRoles.removeRole).not.toHaveBeenCalled();
    });

    it('propagates last-admin guard failures without removing the role', async () => {
        const deps = createDeps({
            assertCanRemoveRole: vi.fn(async () => {
                throw new BusinessRuleError('Cannot remove the last active membership with tenant administration capability');
            }),
        });
        const useCase = createRemoveRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(BusinessRuleError);
        expect(deps.membershipRoles.removeRole).not.toHaveBeenCalled();
    });

    it('removes an assigned role after last-admin checks pass', async () => {
        const deps = createDeps();
        const useCase = createRemoveRole(deps);
        await useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        });
        expect(deps.lastAdminGuard.assertCanRemoveRole).toHaveBeenCalled();
        expect(deps.membershipRoles.removeRole).toHaveBeenCalledWith(MEMBERSHIP_ID, ROLE_ID, {});
    });

    it('compatibility wrapper preserves remove behavior', async () => {
        const deps = createDeps();
        const useCase = new RemoveRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: [],
        })).rejects.toBeInstanceOf(AuthorizationError);
    });
});
