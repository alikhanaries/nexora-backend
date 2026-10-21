/** Maps an internal product shape into an API-safe ProductResponse object (dates serialized where needed). */
export function toProductResponse(product) {
    return {
        id: product.id,
        tenantId: product.tenantId,
        merchantSku: product.merchantSku,
        externalReference: product.externalReference,
        productType: product.productType,
        status: product.status,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    };
}
/** Maps an internal product shape into an API-safe ProductContentResponse object (dates serialized where needed). */
export function toProductContentResponse(content) {
    return {
        id: content.id,
        productId: content.productId,
        tenantId: content.tenantId,
        locale: content.locale,
        title: content.title,
        description: content.description,
        brand: content.brand,
        attributes: { ...content.attributes },
        createdAt: content.createdAt.toISOString(),
        updatedAt: content.updatedAt.toISOString(),
    };
}
