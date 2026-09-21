import { NotFoundError } from '../../../shared/errors/index.js';
import { toShipmentDetailDto, toShipmentDto, } from '../application/shipment-dto.js';
export class DefaultShipmentQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getShipmentById(tenantId, shipmentId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const shipment = await this.deps.shipments.findById(queryable, tenantId, shipmentId);
        if (shipment === null) {
            throw new NotFoundError('Shipment was not found', { tenantId, shipmentId });
        }
        const lines = await this.deps.shipments.listShipmentLines(queryable, tenantId, shipmentId);
        return toShipmentDetailDto(shipment, lines);
    }
    async getShipmentSummaryById(tenantId, shipmentId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const shipment = await this.deps.shipments.findById(queryable, tenantId, shipmentId);
        if (shipment === null) {
            throw new NotFoundError('Shipment was not found', { tenantId, shipmentId });
        }
        return toShipmentDto(shipment);
    }
}
