/** Maps domain channel to ISO-dated API response DTO. */
export function toCommerceIntegrationResponse(channel) {
    return {
        id: channel.id,
        tenantId: channel.tenantId,
        marketplaceId: channel.marketplaceId,
        name: channel.name,
        externalReference: channel.externalReference,
        status: channel.status,
        configurationReference: channel.configurationReference,
        defaultStockLocationId: channel.defaultStockLocationId,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
    };
}
