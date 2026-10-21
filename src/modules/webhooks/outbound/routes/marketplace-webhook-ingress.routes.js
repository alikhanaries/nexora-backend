/**
 * Inbound marketplace webhook ingress HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const MARKETPLACE_WEBHOOK_INGRESS_ROUTES = Object.freeze({
    receiveMarketplaceWebhook: Object.freeze({
        method: 'POST',
        path: '/api/v1/inbound/marketplace-webhooks/:ingressToken',
        public: true,
        handler: 'receiveMarketplaceWebhook',
    }),
});

/** Flat list for inventory / parity tests. */
export const MARKETPLACE_WEBHOOK_INGRESS_ROUTE_LIST = Object.freeze(Object.values(MARKETPLACE_WEBHOOK_INGRESS_ROUTES));
