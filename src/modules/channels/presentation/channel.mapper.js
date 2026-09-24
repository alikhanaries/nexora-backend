export function toChannelResponse(channel) {
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
