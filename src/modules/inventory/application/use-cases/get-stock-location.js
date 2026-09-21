import { NotFoundError } from '../../../../shared/errors/index.js';
export class GetStockLocation {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');
        const location = await this.deps.stockLocations.findById(this.deps.queryable, input.tenantId, input.stockLocationId);
        if (location === null) {
            throw new NotFoundError('Stock location was not found', {
                stockLocationId: input.stockLocationId,
            });
        }
        return { location };
    }
}
