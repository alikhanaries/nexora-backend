export const MarketplaceIntegrationEntityType = Object.freeze({
    PRODUCT: 'product',
    OFFER: 'offer',
    STOCK_LOCATION: 'stock_location',
});

/** @param {string} value */
export function isMarketplaceIntegrationEntityType(value) {
    return value === MarketplaceIntegrationEntityType.PRODUCT ||
        value === MarketplaceIntegrationEntityType.OFFER ||
        value === MarketplaceIntegrationEntityType.STOCK_LOCATION;
}
