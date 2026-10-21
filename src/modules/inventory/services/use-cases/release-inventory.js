import { optionalReferenceFields } from '../optional-fields.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createReleaseInventory(deps) {
    async function execute(input) {
        deps.authorization.requirePermission(input.actorPermissions, 'inventory.reserve');
        return deps.inventoryService.release({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
            ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
        });
    }
    return { execute };
}
