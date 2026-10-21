import { describe, expect, it, vi } from 'vitest';
import {
    AuthorizationError,
    ConflictError,
    NotFoundError,
} from '../../../src/shared/errors/index.js';
import {
    createAssignRole,
} from '../../../src/modules/authorization/services/assign-role.js';
import { createDefaultAuthorizationService } from '../../../src/modules/authorization/services/authorization-service.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const MEMBERSHIP_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_ID = '44444444-4444-4444-8444-444444444444';

function createDeps(overrides = {}) {
    const membership = overrides.membership ?? {
        id: MEMBERSHIP_ID,
        tenantId: TENANT_A,
        status: 'ACTIVE',
    };
    const role = overrides.role ?? {
        id: ROLE_ID,
        tenantId: TENANT_A,
        status: 'ACTIVE',
        name: 'Ops',
    };
    return {
        authorization: createDefaultAuthorizationService(),
        database: {
            execute: vi.fn(async (work) => work({})),
        },
        roles: {
            findById: vi.fn(async () => role),
            listPermissionsForRole: vi.fn(async () => [{ key: 'orders.read' }]),
        },
        membershipRoles: {
            findMembership: vi.fn(async () => membership),
            listRolesForMembership: vi.fn(async () => overrides.assigned ?? []),
            assignRole: vi.fn(async () => undefined),
        },
    };
}

describe('createAssignRole', () => {
    it('fails fast when required dependencies are missing', () => {
        expect(() => createAssignRole({
            authorization: {},
            roles: {},
            membershipRoles: {},
        })).toThrow('createAssignRole requires deps.database');
    });

    it('denies actors without roles.manage', async () => {
        const deps = createDeps();
        const useCase = createAssignRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.read'],
        })).rejects.toBeInstanceOf(AuthorizationError);
        expect(deps.database.execute).not.toHaveBeenCalled();
    });

    it('denies cross-tenant membership access', async () => {
        const deps = createDeps({
            membership: { id: MEMBERSHIP_ID, tenantId: TENANT_B, status: 'ACTIVE' },
        });
        const useCase = createAssignRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(NotFoundError);
        expect(deps.membershipRoles.assignRole).not.toHaveBeenCalled();
    });

    it('denies cross-tenant role assignment', async () => {
        const deps = createDeps({
            role: { id: ROLE_ID, tenantId: TENANT_B, status: 'ACTIVE', name: 'Ops' },
        });
        const useCase = createAssignRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('assigns an active role within the tenant', async () => {
        const deps = createDeps();
        const useCase = createAssignRole(deps);
        const result = await useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        });
        expect(deps.membershipRoles.assignRole).toHaveBeenCalledWith(MEMBERSHIP_ID, ROLE_ID, {});
        expect(result.permissionKeys).toEqual(['orders.read']);
    });

    it('rejects duplicate role assignment', async () => {
        const deps = createDeps({ assigned: [{ id: ROLE_ID }] });
        const useCase = createAssignRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_A,
            membershipId: MEMBERSHIP_ID,
            roleId: ROLE_ID,
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(ConflictError);
    });
});
