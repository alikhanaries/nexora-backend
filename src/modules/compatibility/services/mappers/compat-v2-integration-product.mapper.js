/**
 * Maps platform offer + product SKU to public GET /api/v2/ce/channels/{channelId}/products item shape.
 *
 * @param {{ merchantSku: string }} product
 * @param {{ status: string }} offer
 */
export function mapCompatV2IntegrationProductItem(product, offer) {
    return {
        MerchantProductNo: product.merchantSku,
        IntegrationStatus: mapOfferStatusToCeIntegrationStatus(offer.status),
    };
}

/**
 * @param {string} status
 * @returns {string}
 */
function mapOfferStatusToCeIntegrationStatus(status) {
    switch (status) {
        case 'ACTIVE':
            return 'PUBLISHED';
        case 'SUSPENDED':
            return 'DISABLED';
        default:
            return 'NOTPUBLISHED';
    }
}

/**
 * @param {object[]} items
 * @param {number} totalCount
 * @param {number} pageSize
 */
export function mapCompatV2IntegrationProductCollection(items, totalCount, pageSize) {
    return {
        Success: true,
        StatusCode: 200,
        Content: items,
        Count: totalCount,
        TotalCount: totalCount,
        ItemsPerPage: pageSize,
    };
}
