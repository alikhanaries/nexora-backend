/**
 * Commerce integration (channel) HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const COMMERCE_INTEGRATION_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/channels',
        public: false,
        handler: 'list',
    }),
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/channels',
        public: false,
        handler: 'create',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/channels/:channelId',
        public: false,
        handler: 'getById',
    }),
    patch: Object.freeze({
        method: 'PATCH',
        path: '/api/v1/channels/:channelId',
        public: false,
        handler: 'patch',
    }),
    upsertConnection: Object.freeze({
        method: 'POST',
        path: '/api/v1/channels/:channelId/marketplace-connection',
        public: false,
        handler: 'upsertConnection',
    }),
    getConnection: Object.freeze({
        method: 'GET',
        path: '/api/v1/channels/:channelId/marketplace-connection',
        public: false,
        handler: 'getConnection',
    }),
    patchConnection: Object.freeze({
        method: 'PATCH',
        path: '/api/v1/channels/:channelId/marketplace-connection',
        public: false,
        handler: 'patchConnection',
    }),
    deleteConnection: Object.freeze({
        method: 'DELETE',
        path: '/api/v1/channels/:channelId/marketplace-connection',
        public: false,
        handler: 'deleteConnection',
    }),
    testConnection: Object.freeze({
        method: 'POST',
        path: '/api/v1/channels/:channelId/marketplace-connection/test',
        public: false,
        handler: 'testConnection',
    }),
});

/** Flat list for inventory / parity tests. */
export const COMMERCE_INTEGRATION_ROUTE_LIST = Object.freeze(Object.values(COMMERCE_INTEGRATION_ROUTES));
