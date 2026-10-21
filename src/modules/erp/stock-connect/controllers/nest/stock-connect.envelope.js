/**
 * Standard JSON envelope for StockConnect integration HTTP responses.
 */
/** Wrap successful StockConnect payload with integration metadata. */
export function stockConnectOk(data) {
  return {
    success: true,
    integration: 'stock-connect',
    data,
  };
}
