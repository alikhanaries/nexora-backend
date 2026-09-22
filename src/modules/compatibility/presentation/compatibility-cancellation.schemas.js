import { z } from 'zod';
import { compatibilityPaginationQuerySchema } from './compatibility-order.schemas.js';

function optionalQueryStringArray(schema) {
    return z.preprocess((value) => {
        if (value === undefined) {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value === 'string') {
            return [value];
        }
        return value;
    }, z.array(schema).optional());
}

export const cancellationLineBodySchema = z.object({
    MerchantProductNo: z.string().min(1).max(64),
    Quantity: z.union([z.number().int().positive(), z.string().regex(/^-?(?:0|[1-9]\d*)$/)]),
    OrderLineId: z.union([z.number().int(), z.string().regex(/^-?(?:0|[1-9]\d*)$/)]).optional().nullable(),
});

export const createCancellationBodySchema = z.object({
    MerchantCancellationNo: z.string().min(1).max(250),
    MerchantOrderNo: z.string().min(1).max(60),
    Lines: z.array(cancellationLineBodySchema).min(1),
    Reason: z.string().nullable().optional(),
    ReasonCode: z.string().nullable().optional(),
    IsMerchantCreator: z.boolean().optional(),
});

export const externalCancellationSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(201),
    Message: z.null(),
});

const externalCancellationLineResponseSchema = z.object({
    MerchantProductNo: z.string().nullable().optional(),
    ChannelProductNo: z.string().nullable().optional(),
    Quantity: z.number().int(),
});

export const externalCancellationSchema = z.object({
    MerchantCancellationNo: z.string().nullable().optional(),
    MerchantOrderNo: z.string().nullable().optional(),
    ChannelOrderNo: z.string().nullable().optional(),
    Lines: z.array(externalCancellationLineResponseSchema).nullable().optional(),
    CreatedAt: z.string(),
    Reason: z.string().nullable().optional(),
    IsMerchantCreator: z.boolean().optional(),
});

export const externalCancellationCollectionSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Content: z.array(externalCancellationSchema).nullable(),
    Count: z.number().int(),
    TotalCount: z.number().int(),
    ItemsPerPage: z.number().int(),
});

export const listMerchantCancellationsQuerySchema = compatibilityPaginationQuerySchema.extend({
    CreatedSince: z.coerce.date().optional(),
    CreatedTo: z.coerce.date().optional(),
    UpdatedSince: z.coerce.date().optional(),
    UpdatedTo: z.coerce.date().optional(),
    ChannelOrderNos: optionalQueryStringArray(z.string().min(1)),
    MerchantOrderNos: optionalQueryStringArray(z.string().min(1)),
    MerchantCancellationNos: optionalQueryStringArray(z.string().min(1)),
});
