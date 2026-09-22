import {
    ExternalIdMappingProvider,
    ExternalIdMappingResourceType,
} from '../../external-id-mapping/public/index.js';

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {string} resourceType
 * @param {readonly string[]} resourceIds
 */
export async function findExternalIdsForResources(queryService, tenantId, resourceType, resourceIds) {
    if (resourceIds.length === 0) {
        return new Map();
    }
    const uniqueIds = [...new Set(resourceIds)];
    return queryService.findExternalIdsByResourceIds(
        tenantId,
        ExternalIdMappingProvider.COMPAT_V2,
        resourceType,
        uniqueIds,
    );
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {readonly object[]} orders
 */
export async function loadOrderExternalIdMaps(queryService, tenantId, orders) {
    const orderResourceIds = orders.map((order) => order.id);
    const orderLineResourceIds = orders.flatMap((order) => (order.lines ?? []).map((line) => line.id));
    const [orderIds, orderLineIds] = await Promise.all([
        findExternalIdsForResources(queryService, tenantId, ExternalIdMappingResourceType.ORDER, orderResourceIds),
        findExternalIdsForResources(queryService, tenantId, ExternalIdMappingResourceType.ORDER_LINE, orderLineResourceIds),
    ]);
    return { orderIds, orderLineIds };
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {readonly object[]} shipments
 */
export async function loadShipmentExternalIdMaps(queryService, tenantId, shipments) {
    const shipmentIds = await findExternalIdsForResources(
        queryService,
        tenantId,
        ExternalIdMappingResourceType.SHIPMENT,
        shipments.map((shipment) => shipment.id),
    );
    return { shipmentIds };
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {readonly object[]} cancellations
 */
export async function loadCancellationExternalIdMaps(queryService, tenantId, cancellations) {
    const cancellationIds = await findExternalIdsForResources(
        queryService,
        tenantId,
        ExternalIdMappingResourceType.CANCELLATION,
        cancellations.map((cancellation) => cancellation.id),
    );
    return { cancellationIds };
}

/**
 * @param {import('../../external-id-mapping/public/external-integer-id-mapping-query-service.js').ExternalIntegerIdMappingQueryService} queryService
 * @param {string} tenantId
 * @param {readonly object[]} returns
 */
export async function loadReturnExternalIdMaps(queryService, tenantId, returns) {
    const returnIds = await findExternalIdsForResources(
        queryService,
        tenantId,
        ExternalIdMappingResourceType.RETURN,
        returns.map((returnEntity) => returnEntity.id),
    );
    return { returnIds };
}
