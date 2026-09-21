import { z } from 'zod';
import { PriceStatus } from '../domain/price-status.js';
export const priceIdParamsSchema = z.object({
    priceId: z.string().uuid(),
});
export const createPriceBodySchema = z.object({
    productId: z.string().uuid(),
    currency: z.string().regex(/^[A-Za-z]{3}$/),
    amountMinor: z.number().int().positive(),
    channelId: z.string().uuid().nullable().optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().nullable().optional(),
});
export const updatePriceBodySchema = z
    .object({
    amountMinor: z.number().int().positive().optional(),
    channelId: z.string().uuid().nullable().optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().nullable().optional(),
    status: z.enum([PriceStatus.INACTIVE]).optional(),
})
    .refine((body) => body.amountMinor !== undefined ||
    body.channelId !== undefined ||
    body.validFrom !== undefined ||
    body.validTo !== undefined ||
    body.status !== undefined, { message: 'At least one field must be provided' });
export const listPricesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    channelId: z.string().uuid().optional(),
    currency: z
        .string()
        .regex(/^[A-Za-z]{3}$/)
        .optional(),
    status: z.enum([PriceStatus.ACTIVE, PriceStatus.INACTIVE]).optional(),
});
export const priceResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    productId: z.string().uuid(),
    channelId: z.string().uuid().nullable(),
    currency: z.string(),
    amountMinor: z.number().int(),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime().nullable(),
    status: z.enum([PriceStatus.ACTIVE, PriceStatus.INACTIVE]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const priceSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: priceResponseSchema,
});
export const priceListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(priceResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});
