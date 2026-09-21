import { optionalReferenceFields } from '../optional-fields.js';
export class AdjustInventory {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
        return this.deps.inventoryService.adjust({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            delta: input.delta,
            ...optionalReferenceFields(input),
        });
    }
}
