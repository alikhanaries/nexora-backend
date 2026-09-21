export class ListStockLocations {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');
        const locations = await this.deps.stockLocations.list(this.deps.queryable, input.tenantId);
        return { locations };
    }
}
