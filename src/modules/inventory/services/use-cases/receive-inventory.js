/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createReceiveInventory(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
        return deps.inventoryService.receive({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            quantity: input.quantity,
            ...(input.referenceType === undefined ? {} : { referenceType: input.referenceType }),
            ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
            ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
        });
    }
    return { execute };
}
