/**
 * Pricing HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const PRICE_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/prices',
        public: false,
        handler: 'list',
    }),
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/prices',
        public: false,
        handler: 'create',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/prices/:priceId',
        public: false,
        handler: 'getById',
    }),
    patch: Object.freeze({
        method: 'PATCH',
        path: '/api/v1/prices/:priceId',
        public: false,
        handler: 'patch',
    }),
});

/** Flat list for inventory / parity tests. */
export const PRICE_ROUTE_LIST = Object.freeze(Object.values(PRICE_ROUTES));
