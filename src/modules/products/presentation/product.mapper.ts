import type { ProductContentDto, ProductDto } from '../application/product-dto.js';
import type { productContentResponseSchema, productResponseSchema } from './product.schemas.js';
import type { z } from 'zod';

export type ProductResponse = z.infer<typeof productResponseSchema>;
export type ProductContentResponse = z.infer<typeof productContentResponseSchema>;

export function toProductResponse(product: ProductDto): ProductResponse {
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

export function toProductContentResponse(content: ProductContentDto): ProductContentResponse {
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
