import { optionalReferenceFields } from '../optional-fields.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createReserveInventory(deps) {
    /**
     * HTTP use-case entry for inventory reservation.
     * Requires `inventory.reserve`, forwards caller-supplied `tenantId` and reserve fields
     * to the domain service (tenant boundary is established upstream, not re-validated here).
     */
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
