import { NotFoundError } from '../../../shared/errors/index.js';
import { closeTenantEntity } from '../models/tenant.js';
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
            const updated = closeTenantEntity(existing, new Date());
            await deps.repository.update(tx, updated);
            return updated;
        });
        return { tenant };
    }

    return { execute };
}
