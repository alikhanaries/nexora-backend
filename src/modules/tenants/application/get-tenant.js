import { NotFoundError } from '../../../shared/errors/index.js';
export class GetTenant {
    repository;
    queryable;
    constructor(repository, queryable) {
        this.repository = repository;
        this.queryable = queryable;
    }
    async execute(input) {
        const tenant = await this.repository.findById(this.queryable, input.tenantId);
        if (tenant === null) {
            throw new NotFoundError('Tenant was not found', { tenantId: input.tenantId });
        }
        return { tenant };
    }
}
