import { optionalReferenceFields } from '../optional-fields.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createReleaseInventory(deps) {
    /**
     * HTTP use-case entry for releasing a prior inventory reservation.
     * Requires `inventory.reserve`, forwards caller-supplied `tenantId` and release fields
     * to the domain service (tenant boundary is established upstream, not re-validated here).
     */
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
