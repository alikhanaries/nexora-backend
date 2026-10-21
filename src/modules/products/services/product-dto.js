/** Maps an internal product shape into an API-safe ProductDto object (dates serialized where needed). */
export function toProductDto(product) {
    return {
        id: product.id,
        tenantId: product.tenantId,
        merchantSku: product.merchantSku,
        externalReference: product.externalReference,
        productType: product.productType,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };
}
/** Maps an internal product shape into an API-safe ProductContentDto object (dates serialized where needed). */
export function toProductContentDto(content) {
    return {
        id: content.id,
        productId: content.productId,
        tenantId: content.tenantId,
        locale: content.locale,
        title: content.title,
        description: content.description,
        brand: content.brand,
        attributes: content.attributes,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
    };
}
