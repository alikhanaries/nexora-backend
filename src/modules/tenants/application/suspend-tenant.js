import { NotFoundError } from '../../../shared/errors/index.js';
export class SuspendTenant {
    repository;
    transactionManager;
    constructor(repository, transactionManager) {
        this.repository = repository;
        this.transactionManager = transactionManager;
    }
    async execute(input) {
        const tenant = await this.transactionManager.execute(async (tx) => {
            const existing = await this.repository.findById(tx, input.tenantId);
            if (existing === null) {
                throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
            }
            const updated = existing.suspend(new Date());
            await this.repository.update(tx, updated);
            return updated;
        });
        return { tenant };
    }
}
