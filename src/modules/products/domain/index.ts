export { Product, type ProductProps, type ProductUpdateProps } from './product.js';
export { ProductStatus } from './product-status.js';
export { ProductType } from './product-type.js';
export { ProductContent, validateLocale } from './product-content.js';
export { normalizeMerchantSku, validateMerchantSku } from './merchant-sku.js';
export type { ProductRepository, ListProductsFilter } from './ports/product-repository.js';
export type { ProductContentRepository } from './ports/product-content-repository.js';
