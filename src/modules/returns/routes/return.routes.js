/**
 * Return HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const RETURN_ROUTES = Object.freeze({
    createForOrder: Object.freeze({
        method: 'POST',
        path: '/api/v1/orders/:orderId/returns',
        public: false,
        handler: 'createForOrder',
    }),
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/returns',
        public: false,
        handler: 'list',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/returns/:returnId',
        public: false,
        handler: 'getById',
    }),
    approve: Object.freeze({
        method: 'POST',
        path: '/api/v1/returns/:returnId/approve',
        public: false,
        handler: 'approve',
    }),
    receive: Object.freeze({
        method: 'POST',
        path: '/api/v1/returns/:returnId/receive',
        public: false,
        handler: 'receive',
    }),
    complete: Object.freeze({
        method: 'POST',
        path: '/api/v1/returns/:returnId/complete',
        public: false,
        handler: 'complete',
    }),
    reject: Object.freeze({
        method: 'POST',
        path: '/api/v1/returns/:returnId/reject',
        public: false,
        handler: 'reject',
    }),
    cancel: Object.freeze({
        method: 'POST',
        path: '/api/v1/returns/:returnId/cancel',
        public: false,
        handler: 'cancel',
    }),
});

/** Flat list for inventory / parity tests. */
export const RETURN_ROUTE_LIST = Object.freeze(Object.values(RETURN_ROUTES));
