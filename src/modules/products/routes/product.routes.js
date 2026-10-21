/**
 * Product HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const PRODUCT_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/products',
        public: false,
        handler: 'list',
    }),
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/products',
        public: false,
        handler: 'create',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/products/:productId',
        public: false,
        handler: 'getById',
    }),
    update: Object.freeze({
        method: 'PATCH',
        path: '/api/v1/products/:productId',
        public: false,
        handler: 'update',
    }),
    deactivate: Object.freeze({
        method: 'POST',
        path: '/api/v1/products/:productId/deactivate',
        public: false,
        handler: 'deactivate',
    }),
    archive: Object.freeze({
        method: 'POST',
        path: '/api/v1/products/:productId/archive',
        public: false,
        handler: 'archive',
    }),
    listContent: Object.freeze({
        method: 'GET',
        path: '/api/v1/products/:productId/content',
        public: false,
        handler: 'listContent',
    }),
    upsertContent: Object.freeze({
        method: 'PUT',
        path: '/api/v1/products/:productId/content/:locale',
        public: false,
        handler: 'upsertContent',
    }),
});

/** Flat list for inventory / parity tests. */
export const PRODUCT_ROUTE_LIST = Object.freeze(Object.values(PRODUCT_ROUTES));
