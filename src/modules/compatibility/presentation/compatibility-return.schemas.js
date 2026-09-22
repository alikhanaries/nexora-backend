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

export const externalReturnStatusSchema = z.enum([
    'NEW',
    'HANDLED',
    'CANCELLED',
    'IN_PROGRESS',
    'AUTO_CLOSED',
]);

export const externalReturnReasonSchema = z.enum([
    'PRODUCT_DEFECT',
    'PRODUCT_UNSATISFACTORY',
    'WRONG_PRODUCT',
    'TOO_MANY_PRODUCTS',
    'REFUSED',
    'REFUSED_DAMAGED',
    'WRONG_ADDRESS',
    'NOT_COLLECTED',
    'WRONG_SIZE',
    'OTHER',
]);

export const returnLineBodySchema = z.object({
    MerchantProductNo: z.string().min(1).max(64),
    Quantity: z.union([z.number().int().positive(), z.string().regex(/^-?(?:0|[1-9]\d*)$/)]),
    OrderLineId: z.union([z.number().int(), z.string().regex(/^-?(?:0|[1-9]\d*)$/)]).optional().nullable(),
    ExtraData: z.record(z.string()).nullable().optional(),
});

export const createReturnBodySchema = z.object({
    MerchantReturnNo: z.string().min(1).max(50),
    MerchantOrderNo: z.string().min(1).max(60),
    Lines: z.array(returnLineBodySchema).min(1),
    Reason: z.string().nullable().optional(),
    MerchantComment: z.string().max(4001).nullable().optional(),
    CustomerComment: z.string().max(4001).nullable().optional(),
    TrackTraceNo: z.string().max(50).nullable().optional(),
    Id: z.union([z.number().int(), z.string().regex(/^-?(?:0|[1-9]\d*)$/)]).optional().nullable(),
    RefundInclVat: z.union([z.number(), z.string()]).optional().nullable(),
    RefundExclVat: z.union([z.number(), z.string()]).optional().nullable(),
    ReturnDate: z.string().nullable().optional(),
    ExtraData: z.record(z.string()).nullable().optional(),
    Rma: z.string().max(250).nullable().optional(),
});

export const externalReturnSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(201),
    Message: z.null(),
});

export const externalReturnMutationSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Message: z.string().nullable().optional(),
});

const externalIntegerSchema = z.union([
    z.string().regex(/^-?(?:0|[1-9]\d*)$/),
    z.number().int(),
]);

export const acknowledgeReturnBodySchema = z.object({
    MerchantReturnNo: z.string().min(1).max(50),
    ReturnId: externalIntegerSchema.optional().nullable(),
});

const returnReceiveLineBodySchema = z.object({
    MerchantProductNo: z.string().min(1).max(64),
    AcceptedQuantity: externalIntegerSchema,
    RejectedQuantity: externalIntegerSchema,
});

export const receiveReturnBodySchema = z.object({
    ReturnId: externalIntegerSchema,
    Lines: z.array(returnReceiveLineBodySchema).min(1),
});

const externalReturnLineResponseSchema = z.object({
    MerchantProductNo: z.string().nullable().optional(),
    Quantity: z.number().int(),
});

export const externalReturnSchema = z.object({
    Id: externalIntegerSchema.optional(),
    MerchantOrderNo: z.string().nullable().optional(),
    ChannelOrderNo: z.string().nullable().optional(),
    ChannelName: z.string().nullable().optional(),
    Lines: z.array(externalReturnLineResponseSchema).nullable().optional(),
    CreatedAt: z.string(),
    UpdatedAt: z.string(),
    MerchantReturnNo: z.string().nullable().optional(),
    Status: externalReturnStatusSchema,
    Reason: z.string().nullable().optional(),
});

export const externalSingleOrderReturnSchema = z.object({
    Id: externalIntegerSchema.optional(),
    MerchantOrderNo: z.string().nullable().optional(),
    Lines: z.array(externalReturnLineResponseSchema).nullable().optional(),
    CreatedAt: z.string(),
    UpdatedAt: z.string(),
    MerchantReturnNo: z.string().nullable().optional(),
    Status: externalReturnStatusSchema,
});

export const externalReturnCollectionSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Content: z.array(externalReturnSchema).nullable(),
    Count: z.number().int(),
    TotalCount: z.number().int(),
    ItemsPerPage: z.number().int(),
});

export const externalSingleOrderReturnCollectionSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Content: z.array(externalSingleOrderReturnSchema).nullable(),
    Count: z.number().int(),
    TotalCount: z.number().int(),
    ItemsPerPage: z.number().int(),
});

export const listMerchantReturnsQuerySchema = compatibilityPaginationQuerySchema.extend({
    MerchantOrderNos: optionalQueryStringArray(z.string().min(1)),
    ChannelOrderNos: optionalQueryStringArray(z.string().min(1)),
    Statuses: optionalQueryStringArray(externalReturnStatusSchema),
    Reasons: optionalQueryStringArray(externalReturnReasonSchema),
    FromDate: z.coerce.date().optional(),
    ToDate: z.coerce.date().optional(),
    FromUpdateDate: z.coerce.date().optional(),
    ToUpdateDate: z.coerce.date().optional(),
});

export const listNewMerchantReturnsQuerySchema = compatibilityPaginationQuerySchema;

export const merchantOrderNoParamsSchema = z.object({
    merchantOrderNo: z.string().min(1),
});
