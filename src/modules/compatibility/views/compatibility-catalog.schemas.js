import { z } from 'zod';

const merchantProductNoSchema = z.string().min(1).max(64);

export const ceProductItemBodySchema = z.object({
    MerchantProductNo: merchantProductNoSchema,
    Name: z.string().nullable().optional(),
    Description: z.string().nullable().optional(),
    Brand: z.string().nullable().optional(),
    ExtraData: z.record(z.string(), z.string()).nullable().optional(),
}).passthrough();

export const postProductsBodySchema = z.union([
    ceProductItemBodySchema,
    z.array(ceProductItemBodySchema).min(1),
    z.object({
        Content: z.array(ceProductItemBodySchema).min(1),
    }).passthrough(),
]);

export const merchantProductNoListBodySchema = z.object({
    MerchantProductNoList: z.array(merchantProductNoSchema).min(1),
}).passthrough();

export const extraDataBulkItemSchema = z.object({
    MerchantProductNo: merchantProductNoSchema,
    ExtraData: z.record(z.string(), z.string()),
});

export const patchExtraDataBulkBodySchema = z.union([
    extraDataBulkItemSchema,
    z.object({
        Content: z.array(extraDataBulkItemSchema).min(1),
    }).passthrough(),
]);

export const putOfferBodySchema = z.object({
    MerchantProductNo: merchantProductNoSchema,
    Price: z.union([z.number(), z.string()]).optional(),
    UnitPrice: z.union([z.number(), z.string()]).optional(),
    CurrencyCode: z.string().min(3).max(3).optional(),
    Currency: z.string().min(3).max(3).optional(),
    ChannelId: z.union([z.string(), z.number()]).optional(),
}).passthrough();

export const offerStockLineSchema = z.object({
    MerchantProductNo: merchantProductNoSchema,
    Stock: z.union([z.number().int(), z.string()]).optional(),
    StockAvailable: z.union([z.number().int(), z.string()]).optional(),
    Quantity: z.union([z.number().int(), z.string()]).optional(),
    ChannelId: z.union([z.string(), z.number()]).optional(),
}).passthrough();

export const putOfferStockBodySchema = z.union([
    offerStockLineSchema,
    z.array(offerStockLineSchema).min(1),
    z.object({
        Content: z.array(offerStockLineSchema).min(1),
    }).passthrough(),
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

export const listProductsByMerchantSkuQuerySchema = z.object({
    merchantProductNoList: optionalQueryStringArray(merchantProductNoSchema),
    MerchantProductNoList: optionalQueryStringArray(merchantProductNoSchema),
}).transform((query) => {
    const list = query.merchantProductNoList ?? query.MerchantProductNoList ?? [];
    return { merchantProductNos: list };
});

export const externalCeMutationEnvelopeSchema = z.object({
    Success: z.boolean(),
    Message: z.string().nullable(),
    ValidationErrors: z.record(z.string(), z.array(z.string())),
    Content: z.unknown(),
});

export const externalCeProductCollectionSchema = z.object({
    Success: z.literal(true),
    Message: z.null(),
    ValidationErrors: z.object({}).passthrough(),
    Content: z.array(z.object({
        MerchantProductNo: z.string(),
        Name: z.string().nullable(),
        Description: z.string().nullable(),
        Brand: z.string().nullable(),
        ExtraData: z.record(z.string(), z.string()).nullable(),
    }).passthrough()),
});
