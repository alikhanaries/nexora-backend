import { z } from 'zod';

const externalAddressSchema = z.object({
    Line1: z.string().nullable().optional(),
    Line2: z.string().nullable().optional(),
    City: z.string().nullable().optional(),
    Region: z.string().nullable().optional(),
    ZipCode: z.string().nullable().optional(),
    CountryIso: z.string().nullable().optional(),
});

const externalOrderLineSchema = z.object({
    ChannelProductNo: z.string(),
    MerchantProductNo: z.string().optional(),
    Quantity: z.number().int(),
    UnitPriceInclVat: z.number(),
    LineTotalInclVat: z.number().optional(),
    Status: z.string().optional(),
});

export const externalOrderSchema = z.object({
    MerchantOrderNo: z.string(),
    ChannelOrderNo: z.string().nullable().optional(),
    ChannelName: z.string().nullable().optional(),
    ChannelReference: z.string().nullable().optional(),
    Status: z.string(),
    Email: z.string(),
    Phone: z.string().nullable().optional(),
    CurrencyCode: z.string(),
    OrderDate: z.string(),
    CreatedAt: z.string().optional(),
    UpdatedAt: z.string().optional(),
    BillingAddress: externalAddressSchema.nullable().optional(),
    ShippingAddress: externalAddressSchema.nullable().optional(),
    SubTotalInclVat: z.number().optional(),
    TotalInclVat: z.number(),
    ShippingCostsInclVat: z.number().optional(),
    Lines: z.array(externalOrderLineSchema).nullable().optional(),
});

export const externalOrderCollectionSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Content: z.array(externalOrderSchema).nullable(),
    Count: z.number().int(),
    TotalCount: z.number().int(),
    ItemsPerPage: z.number().int(),
});

export const externalOrderStatusSchema = z.enum([
    'IN_PROGRESS',
    'SHIPPED',
    'IN_BACKORDER',
    'MANCO',
    'CANCELED',
    'IN_COMBI',
    'CLOSED',
    'NEW',
    'RETURNED',
    'REQUIRES_CORRECTION',
    'AWAITING_PAYMENT',
]);

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

export const compatibilityPaginationQuerySchema = z.object({
    Page: z.coerce.number().int().min(1).optional(),
    ItemsPerPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const listNewOrdersQuerySchema = compatibilityPaginationQuerySchema;

export const listOrdersQuerySchema = compatibilityPaginationQuerySchema.extend({
    Statuses: optionalQueryStringArray(externalOrderStatusSchema),
    MerchantOrderNos: optionalQueryStringArray(z.string().min(1)),
    ChannelOrderNos: optionalQueryStringArray(z.string().min(1)),
    FromDate: z.coerce.date().optional(),
    ToDate: z.coerce.date().optional(),
    FromCreatedAtDate: z.coerce.date().optional(),
    ToCreatedAtDate: z.coerce.date().optional(),
    FromUpdatedAtDate: z.coerce.date().optional(),
    ToUpdatedAtDate: z.coerce.date().optional(),
});

export const externalErrorResponseSchema = z.object({
    Success: z.literal(false),
    StatusCode: z.number().int(),
    Message: z.string(),
    ValidationErrors: z.record(z.array(z.string())).optional(),
});
