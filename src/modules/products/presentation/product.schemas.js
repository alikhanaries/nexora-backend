import { z } from 'zod';
import { ProductStatus } from '../domain/product-status.js';
import { ProductType } from '../domain/product-type.js';
export const productIdParamsSchema = z.object({
    productId: z.string().uuid(),
});
export const productLocaleParamsSchema = z.object({
    productId: z.string().uuid(),
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
});
export const createProductBodySchema = z.object({
    merchantSku: z.string().min(1).max(128),
    externalReference: z.string().max(256).nullable().optional(),
    productType: z.enum([ProductType.STANDARD, ProductType.BUNDLE, ProductType.VARIANT]).optional(),
});
export const updateProductBodySchema = z
    .object({
    externalReference: z.string().max(256).nullable().optional(),
    productType: z.enum([ProductType.STANDARD, ProductType.BUNDLE, ProductType.VARIANT]).optional(),
})
    .refine((body) => body.externalReference !== undefined || body.productType !== undefined, {
    message: 'At least one field must be provided',
});
export const listProductsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    status: z.enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.ARCHIVED]).optional(),
});
export const upsertProductContentBodySchema = z.object({
    title: z.string().max(512).nullable().optional(),
    description: z.string().max(8192).nullable().optional(),
    brand: z.string().max(256).nullable().optional(),
    attributes: z.record(z.unknown()).optional(),
});
export const productResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    merchantSku: z.string(),
    externalReference: z.string().nullable(),
    productType: z.enum([ProductType.STANDARD, ProductType.BUNDLE, ProductType.VARIANT]),
    status: z.enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.ARCHIVED]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const productContentResponseSchema = z.object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    tenantId: z.string().uuid(),
    locale: z.string(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    brand: z.string().nullable(),
    attributes: z.record(z.unknown()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const productSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: productResponseSchema,
});
export const productListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(productResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});
export const productContentListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(productContentResponseSchema),
});
export const productContentSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: productContentResponseSchema,
});
