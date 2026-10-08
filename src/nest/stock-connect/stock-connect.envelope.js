export function stockConnectOk(data) {
  return {
    success: true,
    integration: 'stock-connect',
    data,
  };
}
