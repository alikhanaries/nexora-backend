/**
 * Outbound webhook subscription HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const WEBHOOK_ROUTES = Object.freeze({
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/webhooks',
        public: false,
        handler: 'create',
    }),
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/webhooks',
        public: false,
        handler: 'list',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/webhooks/:webhookId',
        public: false,
        handler: 'getById',
    }),
    update: Object.freeze({
        method: 'PATCH',
        path: '/api/v1/webhooks/:webhookId',
        public: false,
        handler: 'update',
    }),
    delete: Object.freeze({
        method: 'DELETE',
        path: '/api/v1/webhooks/:webhookId',
        public: false,
        handler: 'delete',
    }),
    rotateSecret: Object.freeze({
        method: 'POST',
        path: '/api/v1/webhooks/:webhookId/rotate-secret',
        public: false,
        handler: 'rotateSecret',
    }),
    listDeliveries: Object.freeze({
        method: 'GET',
        path: '/api/v1/webhooks/:webhookId/deliveries',
        public: false,
        handler: 'listDeliveries',
    }),
    getDelivery: Object.freeze({
        method: 'GET',
        path: '/api/v1/webhooks/:webhookId/deliveries/:deliveryId',
        public: false,
        handler: 'getDelivery',
    }),
});

/** Flat list for inventory / parity tests. */
export const WEBHOOK_ROUTE_LIST = Object.freeze(Object.values(WEBHOOK_ROUTES));
