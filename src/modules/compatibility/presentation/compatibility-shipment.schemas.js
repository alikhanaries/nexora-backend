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

const externalIntegerSchema = z.union([
    z.string().regex(/^-?(?:0|[1-9]\d*)$/),
    z.number().int(),
]);

const externalShipmentLineSchema = z.object({
    MerchantProductNo: z.string().min(1).max(64),
    Quantity: externalIntegerSchema,
    OrderLineId: externalIntegerSchema.optional().nullable(),
    ExtraData: z.record(z.string()).optional().nullable(),
});

export const createShipmentBodySchema = z.object({
    MerchantShipmentNo: z.string().min(1).max(250),
    MerchantOrderNo: z.string().min(1).max(60),
    Lines: z.array(externalShipmentLineSchema).min(1).max(100),
    Method: z.string().max(50).optional().nullable(),
    TrackTraceNo: z.string().max(50).optional().nullable(),
    TrackTraceUrl: z.string().max(1024).optional().nullable(),
    ReturnTrackTraceNo: z.string().max(50).optional().nullable(),
    ExtraData: z.record(z.string()).optional().nullable(),
    ShippedFromCountryCode: z.string().max(3).optional().nullable(),
    ShippedFromStockLocationId: externalIntegerSchema.optional().nullable(),
});

export const externalShipmentSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(201),
    Message: z.string().nullable().optional(),
});

export const externalShipmentMutationSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Message: z.string().nullable().optional(),
});

export const merchantShipmentNoParamsSchema = z.object({
    merchantShipmentNo: z.string().min(1).max(250),
});

export const updateShipmentTrackingBodySchema = z.object({
    Method: z.string().min(1).max(50),
    TrackTraceNo: z.string().min(1).max(50),
    ReturnTrackTraceNo: z.string().max(50).nullable().optional(),
    TrackTraceUrl: z.string().max(250).nullable().optional(),
    ShippedFromCountryCode: z.string().max(3).nullable().optional(),
    ReturnMethod: z.string().max(50).nullable().optional(),
});

const externalShipmentLineResponseSchema = z.object({
    MerchantProductNo: z.string().nullable().optional(),
    ChannelProductNo: z.string().nullable().optional(),
    Quantity: z.number().int(),
});

export const externalShipmentSchema = z.object({
    MerchantShipmentNo: z.string().nullable().optional(),
    MerchantOrderNo: z.string().nullable().optional(),
    ChannelOrderNo: z.string().nullable().optional(),
    Lines: z.array(externalShipmentLineResponseSchema).nullable().optional(),
    CreatedAt: z.string(),
    UpdatedAt: z.string(),
    TrackTraceNo: z.string().nullable().optional(),
    Method: z.string().nullable().optional(),
    ShipmentDate: z.string().nullable().optional(),
    DeliveredAt: z.string().nullable().optional(),
});

export const externalShipmentCollectionSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(200),
    Content: z.array(externalShipmentSchema).nullable(),
    Count: z.number().int(),
    TotalCount: z.number().int(),
    ItemsPerPage: z.number().int(),
});

export const listMerchantShipmentsQuerySchema = compatibilityPaginationQuerySchema.extend({
    MerchantShipmentNos: optionalQueryStringArray(z.string().min(1)),
    MerchantOrderNos: optionalQueryStringArray(z.string().min(1)),
    ChannelOrderNos: optionalQueryStringArray(z.string().min(1)),
    Method: z.string().optional(),
    FromShipmentDate: z.coerce.date().optional(),
    ToShipmentDate: z.coerce.date().optional(),
    FromCreateDate: z.coerce.date().optional(),
    ToCreateDate: z.coerce.date().optional(),
    FromUpdateDate: z.coerce.date().optional(),
    ToUpdateDate: z.coerce.date().optional(),
    FromDeliveredAt: z.coerce.date().optional(),
    ToDeliveredAt: z.coerce.date().optional(),
});
