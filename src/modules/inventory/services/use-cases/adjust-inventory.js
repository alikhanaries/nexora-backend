/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createAdjustInventory(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
        return deps.inventoryService.adjust({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            delta: input.delta,
            ...(input.referenceType === undefined ? {} : { referenceType: input.referenceType }),
            ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
            ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
        });
    }
    return { execute };
}
