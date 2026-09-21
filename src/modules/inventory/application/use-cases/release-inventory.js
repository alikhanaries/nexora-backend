import { optionalReferenceFields } from '../optional-fields.js';
export class ReleaseInventory {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.reserve');
        return this.deps.inventoryService.release({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
            ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
        });
    }
}
