import { ValidationError } from '../../../shared/errors/index.js';

const DELIVERED_STATUSES = new Set(['DELIVERED', 'CLOSED']);

/**
 * StockConnect CE PUT /shipments/{merchantShipmentNo}/delivery-state.
 */
export class StockConnectCeShipmentDeliveryCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../shipments/public/shipment-query-service.js').DefaultShipmentQueryService} deps.shipmentQueryService
     * @param {{ execute: Function }} deps.shipShipment
     * @param {{ execute: Function }} deps.deliverShipment
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.actorId
     * @param {'user'|'api-key'} input.actorKind
     * @param {readonly string[]} input.actorPermissions
     * @param {string} input.merchantShipmentNo
     * @param {object} input.body
     */
    async updateDeliveryState(input) {
        const merchantShipmentNo = String(input.merchantShipmentNo ?? '').trim();
        if (!merchantShipmentNo) {
            throw new ValidationError('merchantShipmentNo is required');
        }
        const status = String(input.body?.Status ?? input.body?.status ?? '').trim().toUpperCase();
        if (!status) {
            throw new ValidationError('Status is required');
        }
        const shipment = await this.deps.shipmentQueryService.findShipmentByExternalReference(
            input.tenantId,
            merchantShipmentNo,
        );
        if (!DELIVERED_STATUSES.has(status)) {
            return {
                Success: true,
                StatusCode: 200,
                Message: null,
                Content: {
                    MerchantShipmentNo: merchantShipmentNo,
                    Status: status,
                    Applied: false,
                    Reason: 'STATUS_NOT_MAPPED',
                },
            };
        }
        if (shipment.status === 'DELIVERED') {
            return {
                Success: true,
                StatusCode: 200,
                Message: null,
                Content: {
                    MerchantShipmentNo: merchantShipmentNo,
                    Status: 'DELIVERED',
                    Applied: false,
                    Reason: 'ALREADY_DELIVERED',
                },
            };
        }
        let current = shipment;
        if (current.status === 'CREATED' || current.status === 'READY_TO_SHIP') {
            const shipped = await this.deps.shipShipment.execute({
                tenantId: input.tenantId,
                actorId: input.actorId,
                actorKind: input.actorKind,
                actorPermissions: input.actorPermissions,
                shipmentId: current.id,
            });
            current = shipped.shipment;
        }
        if (current.status === 'SHIPPED' || current.status === 'IN_TRANSIT') {
            await this.deps.deliverShipment.execute({
                tenantId: input.tenantId,
                actorId: input.actorId,
                actorKind: input.actorKind,
                actorPermissions: input.actorPermissions,
                shipmentId: current.id,
            });
        }
        return {
            Success: true,
            StatusCode: 200,
            Message: null,
            Content: {
                MerchantShipmentNo: merchantShipmentNo,
                Status: 'DELIVERED',
                Applied: true,
                DeliveredAt: input.body?.DeliveredAt ?? input.body?.deliveredAt ?? null,
            },
        };
    }
}
