/**
 * Health / foundation HTTP endpoints only — paths and methods.
 */

export const HEALTH_ROUTES = Object.freeze({
    live: Object.freeze({ method: 'GET', path: '/health/live', public: true, handler: 'live' }),
    foundationPing: Object.freeze({
        method: 'GET',
        path: '/api/v1/foundation/ping',
        public: true,
        handler: 'foundationPing',
    }),
    foundationEcho: Object.freeze({
        method: 'POST',
        path: '/api/v1/foundation/echo',
        public: true,
        handler: 'foundationEcho',
    }),
    ready: Object.freeze({ method: 'GET', path: '/health/ready', public: true, handler: 'ready' }),
});

export const HEALTH_ROUTE_LIST = Object.freeze(Object.values(HEALTH_ROUTES));
