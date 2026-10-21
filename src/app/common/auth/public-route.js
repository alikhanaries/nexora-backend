/**
 * Unauthenticated HTTP routes: health/metrics, OpenAPI docs, foundation, auth
 * login/refresh/logout, tenant bootstrap (POST `/api/v1/tenants` and GET by id),
 * and inbound marketplace webhooks. Used by AuthGuard with `@Public()` metadata.
 */
const PUBLIC_ROUTE_PATTERNS = [
  /^\/health\//,
  /^\/internal\/metrics$/,
  /^\/docs(?:\/|$)/,
  /^\/openapi\.json$/,
  /^\/api-docs\.json$/,
  /^\/api-docs$/,
  /^\/api\/v1\/foundation\//,
  /^\/api\/v1\/auth\/login$/,
  /^\/api\/v1\/auth\/refresh$/,
  /^\/api\/v1\/auth\/logout$/,
  /^\/api\/v1\/tenants$/,
  /^\/api\/v1\/inbound\/marketplace-webhooks\/.+$/,
];

/** @returns {boolean} Whether the HTTP method/path pair is allowed without credentials. */
export function isPublicRoute(method, path) {
  if (method === 'POST' && path === '/api/v1/tenants') {
    return true;
  }
  if (method === 'GET' && path.startsWith('/api/v1/tenants/')) {
    return true;
  }
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}
