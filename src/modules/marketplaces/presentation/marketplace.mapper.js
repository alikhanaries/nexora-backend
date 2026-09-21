export function toMarketplaceResponse(marketplace) {
    return {
        id: marketplace.id,
        key: marketplace.key,
        name: marketplace.name,
        status: marketplace.status,
        createdAt: marketplace.createdAt.toISOString(),
        updatedAt: marketplace.updatedAt.toISOString(),
    };
}
