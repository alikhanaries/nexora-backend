/** Dedicated StockConnect integration API (Bearer or API key auth). */
export const STOCK_CONNECT_INTEGRATION_ROUTE_PREFIX = '/api/v2/stock-connect';

/**
 * @param {string} path
 */
export function isStockConnectIntegrationPath(path) {
  return (
    path === STOCK_CONNECT_INTEGRATION_ROUTE_PREFIX
    || path.startsWith(`${STOCK_CONNECT_INTEGRATION_ROUTE_PREFIX}/`)
  );
}
