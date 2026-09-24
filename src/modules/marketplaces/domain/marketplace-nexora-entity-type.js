export const MarketplaceNexoraEntityType = Object.freeze({
    PRODUCT: 'product',
    OFFER: 'offer',
    STOCK_LOCATION: 'stock_location',
});

/** @param {string} value */
export function isMarketplaceNexoraEntityType(value) {
    return value === MarketplaceNexoraEntityType.PRODUCT ||
        value === MarketplaceNexoraEntityType.OFFER ||
        value === MarketplaceNexoraEntityType.STOCK_LOCATION;
}
