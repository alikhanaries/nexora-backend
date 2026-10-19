import { NotFoundError } from '../../../shared/errors/index.js';
import { requireTenantLifecycleAccess } from './tenant-permissions.js';
export class ReactivateTenant {
    repository;
    transactionManager;
    authorization;
    constructor(repository, transactionManager, authorization) {
        this.repository = repository;
        this.transactionManager = transactionManager;
        this.authorization = authorization;
    }
    async execute(input) {
        requireTenantLifecycleAccess(this.authorization, input.actorTenantId, input.tenantId, input.actorPermissions);
        const tenant = await this.transactionManager.execute(async (tx) => {
            const existing = await this.repository.findById(tx, input.tenantId);
            if (existing === null) {
                throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
            }
            const updated = existing.reactivate(new Date());
            await this.repository.update(tx, updated);
            return updated;
        });
        return { tenant };
    }
}
