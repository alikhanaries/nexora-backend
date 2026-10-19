import { describe, expect, it, vi } from 'vitest';
import { createTenantsModule } from '../../../src/modules/tenants/index.js';
import { createCreateTenant } from '../../../src/modules/tenants/services/create-tenant.js';
import { ValidationError } from '../../../src/shared/errors/index.js';

describe('createTenantsModule', () => {
    it('fails fast when required dependencies are missing', () => {
        expect(() => createTenantsModule({})).toThrow('createTenantsModule requires deps.transactionManager');
        expect(() => createTenantsModule({
            transactionManager: {},
        })).toThrow('createTenantsModule requires deps.queryable');
    });

    it('wires lifecycle use cases when required dependencies are present', () => {
        const module = createTenantsModule({
            transactionManager: { execute: vi.fn() },
            queryable: {},
        });
        expect(module.useCases.createTenant).toHaveProperty('execute');
        expect(module.useCases.getTenant).toHaveProperty('execute');
        expect(module.useCases.suspendTenant).toHaveProperty('execute');
        expect(module.useCases.reactivateTenant).toHaveProperty('execute');
        expect(module.useCases.closeTenant).toHaveProperty('execute');
    });
});

describe('createCreateTenant', () => {
    it('rejects missing or non-string names as ValidationError', async () => {
        const useCase = createCreateTenant({
            repository: { insert: vi.fn() },
            transactionManager: { execute: vi.fn() },
        });
        await expect(useCase.execute({ slug: 'acme' })).rejects.toBeInstanceOf(ValidationError);
        await expect(useCase.execute({ name: null, slug: 'acme' })).rejects.toBeInstanceOf(ValidationError);
        await expect(useCase.execute({ name: '   ', slug: 'acme' })).rejects.toBeInstanceOf(ValidationError);
    });
});
