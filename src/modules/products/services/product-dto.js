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
