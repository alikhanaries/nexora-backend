export const CatalogSyncTarget = Object.freeze({
    PRODUCT: 'product',
    OFFER: 'offer',
    INVENTORY: 'inventory',
    PRICE: 'price',
    CHANNEL_INVENTORY_RESYNC: 'channel_inventory_resync',
});

export const CATALOG_SYNC_TARGETS = Object.freeze(Object.values(CatalogSyncTarget));
