/**
 * Audit HTTP endpoints only — paths and methods.
 */

export const AUDIT_ROUTES = Object.freeze({
    list: Object.freeze({
        method: 'GET',
        path: '/api/v1/audit',
        handler: 'list',
        permission: 'audit.read',
    }),
});

export const AUDIT_ROUTE_LIST = Object.freeze(Object.values(AUDIT_ROUTES));
