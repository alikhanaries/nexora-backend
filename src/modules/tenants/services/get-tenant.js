import { NotFoundError } from '../../../shared/errors/index.js';

/**
 * @param {{ repository: object, queryable: object }} deps
 * @returns {{ execute: Function }}
 */
export function createGetTenant(deps) {
    /**
     * @param {{ tenantId: string }} input
     */
    async function execute(input) {
        const tenant = await deps.repository.findById(deps.queryable, input.tenantId);
        if (tenant === null) {
            throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
        }
        return { tenant };
    }

    return { execute };
}

/** @deprecated Prefer {@link createGetTenant}; kept for existing import sites. */
export class GetTenant {
    /**
     * @param {object} repository
     * @param {object} queryable
     */
    constructor(repository, queryable) {
        return createGetTenant({ repository, queryable });
    }
}
