import { NoonCatalogWritesDisabledError } from '../../../models/marketplace-errors.js';

/** POST paths that mutate Noon catalog state (stock, pricing, offer activation). */
const CATALOG_WRITE_PATHS = new Set([
    '/stock/v1/stock-update',
    '/pricing/v1/pricing/upsert',
]);

/**
 * @param {string | undefined} method
 * @param {string} path
 */
export function isNoonCatalogWriteRequest(method, path) {
    const normalizedMethod = (method ?? 'GET').toUpperCase();
    if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
        return false;
    }
    const normalizedPath = path.split('?')[0];
    if (normalizedPath === '/pricing/v1/pricing/get') {
        return false;
    }
    return CATALOG_WRITE_PATHS.has(normalizedPath);
}

/**
 * @param {string} path
 */
export function noonCatalogWriteOperationName(path) {
    const normalizedPath = path.split('?')[0];
    if (normalizedPath === '/stock/v1/stock-update') {
        return 'noon_stock_update';
    }
    if (normalizedPath === '/pricing/v1/pricing/upsert') {
        return 'noon_pricing_upsert';
    }
    return 'noon_catalog_write';
}

/**
 * @param {boolean} catalogWritesEnabled
 * @param {string | undefined} method
 * @param {string} path
 * @param {import('../../../../../shared/logging/logger.port.js').Logger | undefined} logger
 */
export function assertNoonCatalogWritesEnabled(catalogWritesEnabled, method, path, logger) {
    if (catalogWritesEnabled || !isNoonCatalogWriteRequest(method, path)) {
        return;
    }
    const operation = noonCatalogWriteOperationName(path);
    logger?.warn({
        operation,
        noonCatalogWritesEnabled: false,
    }, 'Noon catalog write blocked by configuration');
    throw new NoonCatalogWritesDisabledError(operation);
}
