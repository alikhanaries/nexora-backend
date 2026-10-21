/**
 * ERP StockConnect integration: HTTP surface is Nest-only under `controllers/nest`.
 * Composition root imports `StockConnectIntegrationModule` directly; factory keeps module index parity.
 */
/**
 * @returns {Record<string, never>} Empty object — no programmatic deps; routes are Nest-registered.
 */
export function createStockConnectModule() {
  return {};
}
