/**
 * Identity auth HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const AUTH_ROUTES = Object.freeze({
    login: Object.freeze({
        method: 'POST',
        path: '/api/v1/auth/login',
        public: true,
        handler: 'login',
    }),
    refresh: Object.freeze({
        method: 'POST',
        path: '/api/v1/auth/refresh',
        public: true,
        handler: 'refresh',
    }),
    logout: Object.freeze({
        method: 'POST',
        path: '/api/v1/auth/logout',
        public: true,
        handler: 'logout',
    }),
    me: Object.freeze({
        method: 'GET',
        path: '/api/v1/auth/me',
        public: false,
        handler: 'me',
    }),
});

/** Flat list for inventory / parity tests. */
export const AUTH_ROUTE_LIST = Object.freeze(Object.values(AUTH_ROUTES));
