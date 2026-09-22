import { loadOrderExternalIdMaps } from './compatibility-external-id-enrichment.js';
import { mapEmptyOrderPageToExternalCollection, mapExternalStatusesToNexoraStatuses, mapNewOrderStatusFilter, mapOrderPageToExternalCollection, } from './mappers/compatibility-order.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

function mergeInclusiveLowerBound(...dates) {
    const defined = dates.filter((value) => value !== undefined);
    if (defined.length === 0) {
        return undefined;
    }
    return new Date(Math.max(...defined.map((value) => value.getTime())));
}

function mergeExclusiveUpperBound(...dates) {
    const defined = dates.filter((value) => value !== undefined);
    if (defined.length === 0) {
        return undefined;
    }
    return new Date(Math.min(...defined.map((value) => value.getTime())));
}

export class OrderCompatibilityQuery {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async listNewOrders(input) {
        return this.listOrders({
            ...input,
            externalStatuses: mapNewOrderStatusFilter(),
        });
    }
    async listOrders(input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const page = input.page ?? 1;
        const nexoraStatuses = input.externalStatuses === undefined
            ? undefined
            : mapExternalStatusesToNexoraStatuses(input.externalStatuses);
        if (input.externalStatuses !== undefined && nexoraStatuses !== undefined && nexoraStatuses.length === 0) {
            return mapEmptyOrderPageToExternalCollection(page, pageSize);
        }
        const result = await this.deps.orderQueryService.listOrders({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            ...(nexoraStatuses === undefined ? {} : { statuses: nexoraStatuses }),
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
            const channel = await this.deps.channelQueryService.getChannelById(input.tenantId, channelId);
            channelsById.set(channelId, channel);
        }));
        const externalIdMaps = await loadOrderExternalIdMaps(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            result.items,
        );
        return mapOrderPageToExternalCollection(result, channelsById, externalIdMaps);
    }
}
