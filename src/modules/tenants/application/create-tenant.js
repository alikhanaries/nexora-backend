import { randomUUID } from 'node:crypto';
import { normalizeTenantSlug, validateTenantSlug } from '../../../shared/security/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { Tenant } from '../domain/tenant.js';
export class CreateTenant {
    repository;
    transactionManager;
    constructor(repository, transactionManager) {
        this.repository = repository;
        this.transactionManager = transactionManager;
    }
    async execute(input) {
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Tenant name is required');
        }
        validateTenantSlug(input.slug);
        const slug = normalizeTenantSlug(input.slug);
        const now = new Date();
        const tenant = Tenant.create({
            id: randomUUID(),
            slug,
            name,
            createdAt: now,
        });
        await this.transactionManager.execute(async (tx) => {
            await this.repository.insert(tx, tenant);
        });
        return { tenant };
    }
}
