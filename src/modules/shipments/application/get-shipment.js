import { requireShipmentsRead } from './shipment-permissions.js';
export class GetShipment {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireShipmentsRead(this.deps.authorization, input.actorPermissions);
        const shipment = await this.deps.shipmentQueryService.getShipmentById(input.tenantId, input.shipmentId);
        return { shipment };
    }
}
