/**
 * Compatibility v2 shipment list/get (`/api/v2/shipments*` and `/api/v2/ce/shipments*`) with order enrichment and external integer IDs on the wire.
 */
import { loadOrdersWithLines } from './compatibility-order-enrichment.js';
import { loadShipmentExternalIdMaps } from './compatibility-external-id-enrichment.js';
import { mapShipmentPageToExternalCollection, } from './mappers/compatibility-shipment.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

export class ShipmentCompatibilityQuery {
    deps;
    /** @param {object} deps Shipment and order query services plus external integer id mapping. */
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Lists shipments for merchant `/api/v2/shipments/merchant` and simplified CE poll variants.
     * Enriches with order lines and shipment external integer ids when mapped.
     * @param {object} input Tenant, permissions, pagination, carrier/date/reference filters.
     * @returns {Promise<object>} Shipment ApiResponse page (read-only).
     */
    async listMerchantShipments(input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const page = input.page ?? 1;
        const result = await this.deps.shipmentQueryService.listShipments({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            ...(input.merchantShipmentNos === undefined ? {} : { externalReferences: input.merchantShipmentNos }),
            ...(input.merchantOrderNos === undefined ? {} : { orderNumbers: input.merchantOrderNos }),
            ...(input.channelOrderNos === undefined ? {} : { externalOrderReferences: input.channelOrderNos }),
            ...(input.method === undefined ? {} : { carrier: input.method }),
            ...(input.fromShipmentDate === undefined ? {} : { shippedAfter: input.fromShipmentDate }),
            ...(input.toShipmentDate === undefined ? {} : { shippedBefore: input.toShipmentDate }),
            ...(input.fromCreateDate === undefined ? {} : { createdAfter: input.fromCreateDate }),
            ...(input.toCreateDate === undefined ? {} : { createdBefore: input.toCreateDate }),
            ...(input.fromUpdateDate === undefined ? {} : { updatedAfter: input.fromUpdateDate }),
            ...(input.toUpdateDate === undefined ? {} : { updatedBefore: input.toUpdateDate }),
            ...(input.fromDeliveredAt === undefined ? {} : { deliveredAfter: input.fromDeliveredAt }),
            ...(input.toDeliveredAt === undefined ? {} : { deliveredBefore: input.toDeliveredAt }),
            page,
            pageSize,
            sortDirection: 'asc',
        });
        const ordersById = await loadOrdersWithLines(this.deps.orderQueryService, input.tenantId, result.items.map((item) => item.orderId));
        const externalIdMaps = await loadShipmentExternalIdMaps(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            result.items,
        );
        return mapShipmentPageToExternalCollection(result, ordersById, externalIdMaps);
    }
}
