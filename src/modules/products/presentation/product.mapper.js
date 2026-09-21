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
