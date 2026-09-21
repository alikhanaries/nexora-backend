import { optionalReferenceFields } from '../optional-fields.js';
export class ReceiveInventory {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'inventory.adjust');
        return this.deps.inventoryService.receive({
            tenantId: input.tenantId,
            stockLocationId: input.stockLocationId,
            productId: input.productId,
            quantity: input.quantity,
            ...optionalReferenceFields(input),
        });
    }
}
