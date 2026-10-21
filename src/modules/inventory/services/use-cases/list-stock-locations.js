/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createListStockLocations(deps) {
/** HTTP use-case entry: enforces permissions, scopes to tenant, delegates to domain service. */
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.read');
        const locations = await deps.stockLocations.list(deps.queryable, input.tenantId);
        return { locations };
    }
    return { execute };
}
