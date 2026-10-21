/**
 * Cancellation HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const CANCELLATION_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/cancellations',
        public: false,
        handler: 'list',
    }),
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/cancellations',
        public: false,
        handler: 'create',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/cancellations/:cancellationId',
        public: false,
        handler: 'getById',
    }),
});

/** Flat list for inventory / parity tests. */
export const CANCELLATION_ROUTE_LIST = Object.freeze(Object.values(CANCELLATION_ROUTES));
