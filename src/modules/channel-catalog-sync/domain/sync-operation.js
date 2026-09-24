export const CatalogSyncOperation = Object.freeze({
    SYNC: 'sync',
    ACTIVATE: 'activate',
    DEACTIVATE: 'deactivate',
});

/** @type {readonly string[]} */
export const CATALOG_SYNC_OPERATIONS = Object.freeze(Object.values(CatalogSyncOperation));
