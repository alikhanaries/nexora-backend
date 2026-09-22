import { loadOrdersWithLines } from './compatibility-order-enrichment.js';
import { mapCancellationPageToExternalCollection, } from './mappers/compatibility-cancellation.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

export class CancellationCompatibilityQuery {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async listMerchantCancellations(input) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const page = input.page ?? 1;
        const result = await this.deps.cancellationQueryService.listCancellations({
            tenantId: input.tenantId,
            actorPermissions: input.actorPermissions,
            ...(input.merchantCancellationNos === undefined
                ? {}
                : { externalReferences: input.merchantCancellationNos }),
            ...(input.merchantOrderNos === undefined ? {} : { orderNumbers: input.merchantOrderNos }),
            ...(input.channelOrderNos === undefined ? {} : { externalOrderReferences: input.channelOrderNos }),
            ...(input.createdSince === undefined ? {} : { createdAfter: input.createdSince }),
            ...(input.createdTo === undefined ? {} : { createdBefore: input.createdTo }),
            ...(input.updatedSince === undefined ? {} : { updatedAfter: input.updatedSince }),
            ...(input.updatedTo === undefined ? {} : { updatedBefore: input.updatedTo }),
            page,
            pageSize,
            sortDirection: 'asc',
        });
        const ordersById = await loadOrdersWithLines(this.deps.orderQueryService, input.tenantId, result.items.map((item) => item.orderId));
        return mapCancellationPageToExternalCollection(result, ordersById);
    }
}
