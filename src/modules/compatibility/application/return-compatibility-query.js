import { NotFoundError } from '../../../shared/errors/index.js';
import { loadOrdersWithLines } from './compatibility-order-enrichment.js';
import { loadReturnExternalIdMaps } from './compatibility-external-id-enrichment.js';
import {
    mapEmptyReturnPageToExternalCollection,
    mapExternalReturnStatusesToNexoraStatuses,
    mapNewReturnStatusFilter,
    mapReturnPageToExternalCollection,
    mapSingleOrderReturnCollection,
} from './mappers/compatibility-return.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

export class ReturnCompatibilityQuery {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async listMerchantReturns(input) {
        return this.listReturns({
            ...input,
            externalStatuses: input.externalStatuses,
        });
    }
    async listNewMerchantReturns(input) {
        return this.listReturns({
            ...input,
            externalStatuses: mapNewReturnStatusFilter(),
        });
    }
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
    async listReturns(input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const page = input.page ?? 1;
        const nexoraStatuses = input.externalStatuses === undefined
            ? undefined
            : mapExternalReturnStatusesToNexoraStatuses(input.externalStatuses);
        if (input.externalStatuses !== undefined && nexoraStatuses !== undefined && nexoraStatuses.length === 0) {
            return mapEmptyReturnPageToExternalCollection(pageSize);
        }
        const result = await this.deps.returnQueryService.listReturns({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            ...(nexoraStatuses === undefined ? {} : { statuses: nexoraStatuses }),
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
            const channel = await this.deps.channelQueryService.getChannelById(input.tenantId, channelId);
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
