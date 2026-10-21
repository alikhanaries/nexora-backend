import { requireShipmentsRead } from './shipment-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetShipment(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        requireShipmentsRead(deps.authorization, input.actorPermissions);
        const shipment = await deps.shipmentQueryService.getShipmentById(input.tenantId, input.shipmentId);
        return { shipment };
    }

    return { execute };
}
