/**
 * Maps domain entity to API/DTO shape (dates ISO-encoded in HTTP mappers).
 */
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
