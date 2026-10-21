import { describe, expect, it, vi } from 'vitest';
import {
    AuthorizationError,
    ConflictError,
    ValidationError,
} from '../../../src/shared/errors/index.js';
import {
    createCreateRole,
    CreateRole,
} from '../../../src/modules/authorization/services/create-role.js';
import { createDefaultAuthorizationService } from '../../../src/modules/authorization/services/authorization-service.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function createDeps(overrides = {}) {
    return {
        authorization: createDefaultAuthorizationService(),
        database: {
            execute: vi.fn(async (work) => work({})),
        },
        roles: {
            findByTenantAndName: vi.fn(async () => overrides.existing ?? null),
            create: vi.fn(async (input) => ({
                id: '55555555-5555-4555-8555-555555555555',
                ...input,
            })),
        },
    };
}

describe('createCreateRole', () => {
    it('fails fast when required dependencies are missing', () => {
        expect(() => createCreateRole({})).toThrow('createCreateRole requires deps.authorization');
    });

    it('denies actors without roles.manage', async () => {
        const deps = createDeps();
        const useCase = createCreateRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_ID,
            name: 'Ops',
            permissionKeys: ['orders.read'],
            actorPermissions: ['roles.read'],
        })).rejects.toBeInstanceOf(AuthorizationError);
        expect(deps.database.execute).not.toHaveBeenCalled();
    });

    it('rejects empty names and empty permission sets', async () => {
        const deps = createDeps();
        const useCase = createCreateRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_ID,
            name: '   ',
            permissionKeys: ['orders.read'],
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(ValidationError);
        await expect(useCase.execute({
            tenantId: TENANT_ID,
            name: 'Ops',
            permissionKeys: [],
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects duplicate role names within a tenant', async () => {
        const deps = createDeps({ existing: { id: 'role-1', name: 'Ops' } });
        const useCase = createCreateRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_ID,
            name: 'Ops',
            permissionKeys: ['orders.read'],
            actorPermissions: ['roles.manage'],
        })).rejects.toBeInstanceOf(ConflictError);
    });

    it('creates a custom role when authorized', async () => {
        const deps = createDeps();
        const useCase = createCreateRole(deps);
        const result = await useCase.execute({
            tenantId: TENANT_ID,
            name: 'Ops',
            permissionKeys: ['orders.read'],
            actorPermissions: ['roles.manage'],
        });
        expect(result.name).toBe('Ops');
        expect(deps.roles.create).toHaveBeenCalledOnce();
    });

    it('compatibility wrapper preserves create behavior', async () => {
        const deps = createDeps();
        const useCase = new CreateRole(deps);
        await expect(useCase.execute({
            tenantId: TENANT_ID,
            name: 'Ops',
            permissionKeys: ['orders.read'],
            actorPermissions: [],
        })).rejects.toBeInstanceOf(AuthorizationError);
    });
});
