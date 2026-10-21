/**
 * Order HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const ORDER_ROUTES = Object.freeze({
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/orders',
        public: false,
        handler: 'create',
    }),
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/orders',
        public: false,
        handler: 'list',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/orders/:orderId',
        public: false,
        handler: 'getById',
    }),
    confirm: Object.freeze({
        method: 'POST',
        path: '/api/v1/orders/:orderId/confirm',
        public: false,
        handler: 'confirm',
    }),
    cancel: Object.freeze({
        method: 'POST',
        path: '/api/v1/orders/:orderId/cancel',
        public: false,
        handler: 'cancel',
    }),
});

/** Flat list for inventory / parity tests. */
export const ORDER_ROUTE_LIST = Object.freeze(Object.values(ORDER_ROUTES));
