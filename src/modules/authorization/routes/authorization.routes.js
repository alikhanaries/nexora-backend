/**
 * Authorization HTTP endpoints only — paths and methods.
 * Nest controller methods are the handlers; this file is the single path registry.
 */

export const AUTHORIZATION_ROUTES = Object.freeze({
    listPermissions: Object.freeze({
        method: 'GET',
        path: '/api/v1/permissions',
        public: false,
        handler: 'listPermissions',
    }),
    listRoles: Object.freeze({
        method: 'GET',
        path: '/api/v1/roles',
        public: false,
        handler: 'listRoles',
    }),
    createRole: Object.freeze({
        method: 'POST',
        path: '/api/v1/roles',
        public: false,
        handler: 'createRole',
    }),
    getMembershipRoles: Object.freeze({
        method: 'GET',
        path: '/api/v1/memberships/:membershipId/roles',
        public: false,
        handler: 'getMembershipRoles',
    }),
    assignRole: Object.freeze({
        method: 'POST',
        path: '/api/v1/memberships/:membershipId/roles',
        public: false,
        handler: 'assignRole',
    }),
    removeRole: Object.freeze({
        method: 'DELETE',
        path: '/api/v1/memberships/:membershipId/roles/:roleId',
        public: false,
        handler: 'removeRole',
    }),
});

/** Flat list for inventory / parity tests. */
export const AUTHORIZATION_ROUTE_LIST = Object.freeze(Object.values(AUTHORIZATION_ROUTES));
