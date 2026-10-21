import { optionalReferenceFields } from '../optional-fields.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createReserveInventory(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.reserve');
        return deps.inventoryService.reserve({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            quantity: input.quantity,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
        });
    }
    return { execute };
}
