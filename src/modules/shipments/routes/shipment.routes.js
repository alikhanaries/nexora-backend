/**
 * Shipment HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const SHIPMENT_ROUTES = Object.freeze({
    createForOrder: Object.freeze({
        method: 'POST',
        path: '/api/v1/orders/:orderId/shipments',
        public: false,
        handler: 'createForOrder',
    }),
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/shipments',
        public: false,
        handler: 'list',
    }),
    getById: Object.freeze({
        method: 'GET',
        path: '/api/v1/shipments/:shipmentId',
        public: false,
        handler: 'getById',
    }),
    ship: Object.freeze({
        method: 'POST',
        path: '/api/v1/shipments/:shipmentId/ship',
        public: false,
        handler: 'ship',
    }),
    deliver: Object.freeze({
        method: 'POST',
        path: '/api/v1/shipments/:shipmentId/deliver',
        public: false,
        handler: 'deliver',
    }),
    cancel: Object.freeze({
        method: 'POST',
        path: '/api/v1/shipments/:shipmentId/cancel',
        public: false,
        handler: 'cancel',
    }),
});

/** Flat list for inventory / parity tests. */
export const SHIPMENT_ROUTE_LIST = Object.freeze(Object.values(SHIPMENT_ROUTES));
