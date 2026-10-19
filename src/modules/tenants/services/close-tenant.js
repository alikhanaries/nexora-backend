import { NotFoundError } from '../../../shared/errors/index.js';
import { requireTenantLifecycleAccess } from './tenant-permissions.js';

/**
 * @param {{ repository: object, transactionManager: object, authorization: object }} deps
 * @returns {{ execute: Function }}
 */
export function createCloseTenant(deps) {
    /**
     * @param {object} input
     */
    async function execute(input) {
        requireTenantLifecycleAccess(deps.authorization, input.actorTenantId, input.tenantId, input.actorPermissions);
        const tenant = await deps.transactionManager.execute(async (tx) => {
            const existing = await deps.repository.findById(tx, input.tenantId);
            if (existing === null) {
                throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
            }
            const updated = existing.close(new Date());
            await deps.repository.update(tx, updated);
            return updated;
        });
        return { tenant };
    }

    return { execute };
}

/** @deprecated Prefer {@link createCloseTenant}; kept for existing import sites. */
export class CloseTenant {
    /**
     * @param {object} repository
     * @param {object} transactionManager
     * @param {object} authorization
     */
    constructor(repository, transactionManager, authorization) {
        return createCloseTenant({ repository, transactionManager, authorization });
    }
}
