/** Additive merchant compatibility route prefix (query apiKey auth applies here only). */
export const MERCHANT_COMPAT_QUERY_AUTH_ROUTE_PREFIX = '/api/v2/ce';

/**
 * @param {string} path
 */
export function isMerchantCompatQueryAuthPath(path) {
    return path === MERCHANT_COMPAT_QUERY_AUTH_ROUTE_PREFIX
        || path.startsWith(`${MERCHANT_COMPAT_QUERY_AUTH_ROUTE_PREFIX}/`);
}
