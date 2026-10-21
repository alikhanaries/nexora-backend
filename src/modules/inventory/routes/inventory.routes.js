/**
 * Inventory HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const INVENTORY_ROUTES = Object.freeze({
    listStockLocations: Object.freeze({
        method: 'GET',
        path: '/api/v1/stock-locations',
        public: false,
        handler: 'listStockLocations',
    }),
    createStockLocation: Object.freeze({
        method: 'POST',
        path: '/api/v1/stock-locations',
        public: false,
        handler: 'createStockLocation',
    }),
    getStockLocation: Object.freeze({
        method: 'GET',
        path: '/api/v1/stock-locations/:stockLocationId',
        public: false,
        handler: 'getStockLocation',
    }),
    listInventory: Object.freeze({
        method: 'GET',
        path: '/api/v1/inventory',
        public: false,
        handler: 'listInventory',
    }),
    getProductInventory: Object.freeze({
        method: 'GET',
        path: '/api/v1/inventory/:productId',
        public: false,
        handler: 'getProductInventory',
    }),
    adjust: Object.freeze({
        method: 'POST',
        path: '/api/v1/inventory/adjustments',
        public: false,
        handler: 'adjust',
    }),
    receive: Object.freeze({
        method: 'POST',
        path: '/api/v1/inventory/receipts',
        public: false,
        handler: 'receive',
    }),
    reserve: Object.freeze({
        method: 'POST',
        path: '/api/v1/inventory/reservations',
        public: false,
        handler: 'reserve',
    }),
    release: Object.freeze({
        method: 'POST',
        path: '/api/v1/inventory/releases',
        public: false,
        handler: 'release',
    }),
});

/** Flat list for inventory / parity tests. */
export const INVENTORY_ROUTE_LIST = Object.freeze(Object.values(INVENTORY_ROUTES));
