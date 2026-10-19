export class GetInventory {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');
        const balances = await this.deps.inventoryRepository.listBalances(this.deps.queryable, input.tenantId, {
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            ...(input.stockLocationId === undefined ? {} : { stockLocationId: input.stockLocationId }),
        });
        return { balances };
    }
}
