import { describe, expect, it, vi } from 'vitest';
import { createAuthorizationModule } from '../../../src/modules/authorization/create-authorization-module.js';

vi.mock('../../../src/modules/authorization/repositories/postgres-permission-repository.js', () => ({
    createPostgresPermissionRepository: vi.fn(() => ({})),
}));
vi.mock('../../../src/modules/authorization/repositories/postgres-role-repository.js', () => ({
    createPostgresRoleRepository: vi.fn(() => ({})),
}));
vi.mock('../../../src/modules/authorization/repositories/postgres-membership-role-repository.js', () => ({
    createPostgresMembershipRoleRepository: vi.fn(() => ({})),
}));

describe('createAuthorizationModule', () => {
    it('fails fast when database is missing', () => {
        expect(() => createAuthorizationModule({})).toThrow(
            /createAuthorizationModule requires deps\.database/,
        );
    });

    it('wires factory-based use cases and authorization service without legacy routes', () => {
        const module = createAuthorizationModule({
            database: { execute: vi.fn() },
        });
        expect(module.authorizationService).toHaveProperty('requirePermission');
        expect(module.useCases.createRole).toHaveProperty('execute');
        expect(module.useCases.listRoles).toHaveProperty('execute');
        expect(module.useCases.assignRole).toHaveProperty('execute');
        expect(module.useCases.removeRole).toHaveProperty('execute');
        expect(module.useCases.listPermissions).toHaveProperty('execute');
        expect(module.useCases.getEffectivePermissions).toHaveProperty('execute');
        expect(module.useCases.systemRoleSeeder).toHaveProperty('execute');
        expect(module.routes).toBeUndefined();
    });
});
