import type { Product } from '../domain/product.js';
import type { ProductContent } from '../domain/product-content.js';
import type { ProductStatus } from '../domain/product-status.js';
import type { ProductType } from '../domain/product-type.js';

export interface ProductDto {
  readonly id: string;
  readonly tenantId: string;
  readonly merchantSku: string;
  readonly externalReference: string | null;
  readonly productType: ProductType;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductContentDto {
  readonly id: string;
  readonly productId: string;
  readonly tenantId: string;
  readonly locale: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly brand: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function toProductDto(product: Product): ProductDto {
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

export function toProductContentDto(content: ProductContent): ProductContentDto {
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
