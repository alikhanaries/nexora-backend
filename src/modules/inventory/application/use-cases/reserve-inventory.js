import { optionalReferenceFields } from '../optional-fields.js';
export class ReserveInventory {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.reserve');
        return this.deps.inventoryService.reserve({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            quantity: input.quantity,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            ...optionalReferenceFields({ idempotencyKey: input.idempotencyKey }),
        });
    }
}
