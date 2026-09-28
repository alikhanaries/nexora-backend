/**
 * Maps Nexora offer + product SKU to CE GET /channels/{channelId}/products item shape.
 *
 * @param {{ merchantSku: string }} product
 * @param {{ status: string }} offer
 */
export function mapStockConnectCeChannelProductItem(product, offer) {
    return {
        MerchantProductNo: product.merchantSku,
        ChannelStatus: mapOfferStatusToCeChannelStatus(offer.status),
    };
}

/**
 * @param {string} status
 * @returns {string}
 */
function mapOfferStatusToCeChannelStatus(status) {
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
export function mapStockConnectCeChannelProductCollection(items, totalCount, pageSize) {
    return {
        Success: true,
        StatusCode: 200,
        Content: items,
        Count: totalCount,
        TotalCount: totalCount,
        ItemsPerPage: pageSize,
    };
}
