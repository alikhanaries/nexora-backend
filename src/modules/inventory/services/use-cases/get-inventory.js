/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetInventory(deps) {
/** HTTP use-case entry: enforces permissions, scopes to tenant, delegates to domain service. */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');
        const balances = await deps.inventoryRepository.listBalances(deps.queryable, input.tenantId, {
            ...(input.productId === undefined ? {} : { productId: input.productId }),
            ...(input.stockLocationId === undefined ? {} : { stockLocationId: input.stockLocationId }),
        });
        return { balances };
    }
    return { execute };
}
