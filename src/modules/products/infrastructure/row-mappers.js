import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Product } from '../domain/product.js';
import { ProductContent } from '../domain/product-content.js';
import { ProductStatus } from '../domain/product-status.js';
import { ProductType } from '../domain/product-type.js';
const productRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    merchant_sku: z.string(),
    external_reference: z.string().nullable(),
    product_type: z.enum([ProductType.STANDARD, ProductType.BUNDLE, ProductType.VARIANT]),
    status: z.enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.ARCHIVED]),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
});
const productContentRowSchema = z.object({
    id: z.string().uuid(),
    product_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    locale: z.string(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    brand: z.string().nullable(),
    attributes: z.record(z.unknown()),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
});
export function toProduct(row) {
    const parsed = parseOrThrow(productRowSchema, row, 'products row');
    return Product.reconstitute({
        id: parsed.id,
        tenantId: parsed.tenant_id,
        merchantSku: parsed.merchant_sku,
        externalReference: parsed.external_reference,
        productType: parsed.product_type,
        status: parsed.status,
        createdAt: parsed.created_at,
        updatedAt: parsed.updated_at,
    });
}
export function toProductContent(row) {
    const parsed = parseOrThrow(productContentRowSchema, row, 'product_content row');
    return ProductContent.reconstitute({
        id: parsed.id,
        productId: parsed.product_id,
        tenantId: parsed.tenant_id,
        locale: parsed.locale,
        title: parsed.title,
        description: parsed.description,
        brand: parsed.brand,
        attributes: parsed.attributes,
        createdAt: parsed.created_at,
        updatedAt: parsed.updated_at,
    });
}
export const PRODUCT_SELECT_COLUMNS = `
  id, tenant_id, merchant_sku, external_reference, product_type, status, created_at, updated_at
`;
export const PRODUCT_CONTENT_SELECT_COLUMNS = `
  id, product_id, tenant_id, locale, title, description, brand, attributes, created_at, updated_at
`;
