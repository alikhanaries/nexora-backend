/**
 * External compatibility CE order read queries (pagination, status filters, CE DTO shape).
 */
import { loadOrderExternalIdMaps } from './compatibility-external-id-enrichment.js';
import {
    mapEmptyOrderPageToExternalCollection,
    mapExternalStatusesToPlatformStatuses,
} from './mappers/compatibility-order.mapper.js';
import { mapCompatV2OrderPageToExternalCollection } from './mappers/compat-v2-order.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

/** Latest defined instant among date filters (inclusive lower bound for created-after). */
function mergeInclusiveLowerBound(...dates) {
    const defined = dates.filter((value) => value !== undefined);
    if (defined.length === 0) {
        return undefined;
    }
    return new Date(Math.max(...defined.map((value) => value.getTime())));
}

/** Earliest defined instant among date filters (upper bound for created-before). */
function mergeExclusiveUpperBound(...dates) {
    const defined = dates.filter((value) => value !== undefined);
    if (defined.length === 0) {
        return undefined;
    }
    return new Date(Math.min(...defined.map((value) => value.getTime())));
}

/**
 * Compat v2 order polling — same list semantics as OrderCompatibilityQuery.listOrders
 * but maps to the public `/api/v2/ce/*` field shapes. Does not alter /api/v2/orders or /orders/new.
 */
export class CompatV2OrderQuery {
    deps;

    /** @param {import('./order-compatibility-query.js').OrderCompatibilityQuery['deps']} deps */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * GET `/api/v2/ce/orders` poll — same core list as merchant v2 but CE DTO mapper on output.
     * @param {object} input Tenant, permissions, page/pageSize (and optional filters when extended).
     * @returns {Promise<object>} CE-shaped order page with external integer ids.
     */
    async listOrdersForCompatV2Poll(input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const page = input.page ?? 1;
        const platformStatuses = input.externalStatuses === undefined
            ? undefined
            : mapExternalStatusesToPlatformStatuses(input.externalStatuses);
        if (input.externalStatuses !== undefined && platformStatuses !== undefined && platformStatuses.length === 0) {
            return mapEmptyOrderPageToExternalCollection(page, pageSize);
        }
        const result = await this.deps.orderQueryService.listOrders({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            ...(platformStatuses === undefined ? {} : { statuses: platformStatuses }),
            ...(input.merchantOrderNos === undefined ? {} : { orderNumbers: input.merchantOrderNos }),
            ...(input.channelOrderNos === undefined
                ? {}
                : { externalOrderReferences: input.channelOrderNos }),
            ...(mergeInclusiveLowerBound(input.fromDate, input.fromCreatedAtDate) === undefined
                ? {}
                : { createdAfter: mergeInclusiveLowerBound(input.fromDate, input.fromCreatedAtDate) }),
            ...(mergeExclusiveUpperBound(input.toDate, input.toCreatedAtDate) === undefined
                ? {}
                : { createdBefore: mergeExclusiveUpperBound(input.toDate, input.toCreatedAtDate) }),
            ...(input.fromUpdatedAtDate === undefined ? {} : { updatedAfter: input.fromUpdatedAtDate }),
            ...(input.toUpdatedAtDate === undefined ? {} : { updatedBefore: input.toUpdatedAtDate }),
            page,
            pageSize,
        });
        const channelIds = [...new Set(result.items.map((order) => order.channelId))];
        const channelsById = new Map();
        await Promise.all(channelIds.map(async (channelId) => {
            const channel = await this.deps.commerceIntegrationQueryService.getCommerceIntegrationById(input.tenantId, channelId);
            channelsById.set(channelId, channel);
        }));
        const externalIdMaps = await loadOrderExternalIdMaps(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            result.items,
        );
        return mapCompatV2OrderPageToExternalCollection(result, channelsById, externalIdMaps);
    }
}
