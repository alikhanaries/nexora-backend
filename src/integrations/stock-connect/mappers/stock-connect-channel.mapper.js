/**
 * @param {ReturnType<import('../../../modules/commerce-integrations/views/commerce-integration.mapper.js').toCommerceIntegrationResponse>} channel
 */
export function toStockConnectChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    marketplaceId: channel.marketplaceId,
    externalReference: channel.externalReference,
    status: channel.status,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}
