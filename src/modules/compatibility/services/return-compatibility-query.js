import { NotFoundError } from '../../../shared/errors/index.js';
import { loadOrdersWithLines } from './compatibility-order-enrichment.js';
import { loadReturnExternalIdMaps } from './compatibility-external-id-enrichment.js';
import {
    mapEmptyReturnPageToExternalCollection,
    mapExternalReturnStatusesToPlatformStatuses,
    mapNewReturnStatusFilter,
    mapReturnPageToExternalCollection,
    mapSingleOrderReturnCollection,
} from './mappers/compatibility-return.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

/** Return list/ack flows for merchant compatibility v2 and CE read paths. */
export class ReturnCompatibilityQuery {
    deps;
    /** @param {object} deps Return, order, commerce integration, and external id mapping services. */
    constructor(deps) {
        this.deps = deps;
    }
    /** Delegates to listReturns preserving caller-provided external status filters. */
    async listMerchantReturns(input) {
        return this.listReturns({
            ...input,
            externalStatuses: input.externalStatuses,
        });
    }
    /** `/api/v2/returns/merchant/new` — applies new-return external status preset (IN_PROGRESS platform filter). */
    async listNewMerchantReturns(input) {
        return this.listReturns({
            ...input,
            externalStatuses: mapNewReturnStatusFilter(),
        });
    }
    /**
     * Loads returns for one merchant order number; 404 when order missing.
     * @param {object} input tenantId, permissions, merchantOrderNo.
     * @returns {Promise<object>} Single-order return collection with external integer ids.
     */
    async listReturnsByMerchantOrderNo(input) {
        const order = await this.deps.orderQueryService.findOrderByOrderNumber(input.tenantId, input.merchantOrderNo);
        if (order === null) {
            throw new NotFoundError('Order was not found', { merchantOrderNo: input.merchantOrderNo });
        }
        const result = await this.deps.returnQueryService.listReturns({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            orderNumbers: [input.merchantOrderNo],
            page: 1,
            pageSize: 100,
        });
        const ordersById = await loadOrdersWithLines(this.deps.orderQueryService, input.tenantId, [order.id]);
        const externalIdMaps = await loadReturnExternalIdMaps(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            result.items,
        );
        return mapSingleOrderReturnCollection(result.items, ordersById, externalIdMaps);
    }
    /**
     * Core return listing: maps external statuses, loads orders/channels, attaches external id maps.
     * @param {object} input Tenant-scoped filters and pagination.
     * @returns {Promise<object>} Return page envelope.
     */
    async listReturns(input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const page = input.page ?? 1;
        const platformStatuses = input.externalStatuses === undefined
            ? undefined
            : mapExternalReturnStatusesToPlatformStatuses(input.externalStatuses);
        if (input.externalStatuses !== undefined && platformStatuses !== undefined && platformStatuses.length === 0) {
            return mapEmptyReturnPageToExternalCollection(pageSize);
        }
        const result = await this.deps.returnQueryService.listReturns({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            ...(platformStatuses === undefined ? {} : { statuses: platformStatuses }),
            ...(input.merchantOrderNos === undefined ? {} : { orderNumbers: input.merchantOrderNos }),
            ...(input.channelOrderNos === undefined ? {} : { externalOrderReferences: input.channelOrderNos }),
            ...(input.reasons === undefined ? {} : { reasons: input.reasons }),
            ...(input.fromDate === undefined ? {} : { createdAfter: input.fromDate }),
            ...(input.toDate === undefined ? {} : { createdBefore: input.toDate }),
            ...(input.fromUpdateDate === undefined ? {} : { updatedAfter: input.fromUpdateDate }),
            ...(input.toUpdateDate === undefined ? {} : { updatedBefore: input.toUpdateDate }),
            page,
            pageSize,
        });
        const ordersById = await loadOrdersWithLines(this.deps.orderQueryService, input.tenantId, result.items.map((item) => item.orderId));
        const channelIds = [...new Set([...ordersById.values()].map((order) => order.channelId))];
        const channelsById = new Map();
        await Promise.all(channelIds.map(async (channelId) => {
            const channel = await this.deps.commerceIntegrationQueryService.getCommerceIntegrationById(input.tenantId, channelId);
            channelsById.set(channelId, channel);
        }));
        const externalIdMaps = await loadReturnExternalIdMaps(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            result.items,
        );
        return mapReturnPageToExternalCollection(result, ordersById, channelsById, externalIdMaps);
    }
}
