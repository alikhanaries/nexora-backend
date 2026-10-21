/**
 * Offer HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const OFFER_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/offers',
        public: false,
        handler: 'list',
    }),
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/offers',
        public: false,
        handler: 'create',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/offers/:offerId',
        public: false,
        handler: 'getById',
    }),
    patch: Object.freeze({
        method: 'PATCH',
        path: '/api/v1/offers/:offerId',
        public: false,
        handler: 'patch',
    }),
    activate: Object.freeze({
        method: 'POST',
        path: '/api/v1/offers/:offerId/activate',
        public: false,
        handler: 'activate',
    }),
});

/** Flat list for inventory / parity tests. */
export const OFFER_ROUTE_LIST = Object.freeze(Object.values(OFFER_ROUTES));
