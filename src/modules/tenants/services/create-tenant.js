import { randomUUID } from 'node:crypto';
import { normalizeTenantSlug, validateTenantSlug } from '../../../shared/security/index.js';
import { ValidationError } from '../../../shared/errors/index.js';
import { Tenant } from '../models/tenant.js';

/**
 * @param {{ repository: object, transactionManager: object }} deps
 * @returns {{ execute: Function }}
 */
export function createCreateTenant(deps) {
    /**
     * @param {{ name: string, slug: string }} input
     */
    async function execute(input) {
        const name = typeof input?.name === 'string' ? input.name.trim() : '';
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
        await deps.transactionManager.execute(async (tx) => {
            await deps.repository.insert(tx, tenant);
        });
        return { tenant };
    }

    return { execute };
}

/** @deprecated Prefer {@link createCreateTenant}; kept for existing import sites. */
export class CreateTenant {
    /**
     * @param {object} repository
     * @param {object} transactionManager
     */
    constructor(repository, transactionManager) {
        return createCreateTenant({ repository, transactionManager });
    }
}
