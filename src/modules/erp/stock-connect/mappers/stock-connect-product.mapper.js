/**
 * @param {import('../../../products/views/product.mapper.js').toProductResponse extends (p: infer P) => infer R ? P : never} product
 * @param {{ totalAvailable?: number } | null} [inventorySummary]
 */
export function toStockConnectProduct(product, inventorySummary = null) {
  return {
    id: product.id,
    merchantSku: product.merchantSku,
    externalReference: product.externalReference,
    productType: product.productType,
    status: product.status,
    createdAt: product.createdAt instanceof Date ? product.createdAt.toISOString() : product.createdAt,
    updatedAt: product.updatedAt instanceof Date ? product.updatedAt.toISOString() : product.updatedAt,
    ...(inventorySummary === null
      ? {}
      : {
          inventorySummary: {
            totalAvailable: inventorySummary.totalAvailable ?? 0,
          },
        }),
  };
}
