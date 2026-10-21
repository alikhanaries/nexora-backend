/**
 * Tenant HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const TENANT_ROUTES = Object.freeze({
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/tenants',
        public: true,
        handler: 'create',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/tenants/:tenantId',
        public: true,
        handler: 'getById',
    }),
    suspend: Object.freeze({
        method: 'POST',
        path: '/api/v1/tenants/:tenantId/suspend',
        public: false,
        handler: 'suspend',
    }),
    reactivate: Object.freeze({
        method: 'POST',
        path: '/api/v1/tenants/:tenantId/reactivate',
        public: false,
        handler: 'reactivate',
    }),
    close: Object.freeze({
        method: 'POST',
        path: '/api/v1/tenants/:tenantId/close',
        public: false,
        handler: 'close',
    }),
});

/** Flat list for inventory / parity tests. */
export const TENANT_ROUTE_LIST = Object.freeze(Object.values(TENANT_ROUTES));
