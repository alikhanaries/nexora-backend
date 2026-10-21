import { loadOrdersWithLines } from './compatibility-order-enrichment.js';
import { loadCancellationExternalIdMaps } from './compatibility-external-id-enrichment.js';
import { mapCancellationPageToExternalCollection, } from './mappers/compatibility-cancellation.mapper.js';

const DEFAULT_PAGE_SIZE = 50;

/** Read façade for `/api/v2/cancellations/merchant` with order enrichment and external integer IDs. */
export class CancellationCompatibilityQuery {
    deps;
    /** @param {object} deps Cancellation query, order query, and external id mapping services. */
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Lists cancellations for a tenant with optional reference and date filters.
     * Loads related orders and maps cancellation external integer ids for the wire envelope.
     * @param {object} input Tenant id, permissions, pagination, and filter fields from HTTP layer.
     * @returns {Promise<object>} External ApiResponse page; read-only, no idempotency side effects.
     */
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
        const externalIdMaps = await loadCancellationExternalIdMaps(
            this.deps.externalIntegerIdMappingQueryService,
            input.tenantId,
            result.items,
        );
        return mapCancellationPageToExternalCollection(result, ordersById, externalIdMaps);
    }
}
