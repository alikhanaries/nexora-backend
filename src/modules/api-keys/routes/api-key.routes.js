/**
 * API key HTTP endpoints only — paths and methods.
 */

export const API_KEY_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/api-keys',
        handler: 'list',
    }),
    create: Object.freeze({
        method: 'POST',
        path: '/api/v1/api-keys',
        handler: 'create',
    }),
    rotate: Object.freeze({
        method: 'POST',
        path: '/api/v1/api-keys/:apiKeyId/rotate',
        handler: 'rotate',
    }),
    revoke: Object.freeze({
        method: 'POST',
        path: '/api/v1/api-keys/:apiKeyId/revoke',
        handler: 'revoke',
    }),
});

export const API_KEY_ROUTE_LIST = Object.freeze(Object.values(API_KEY_ROUTES));
