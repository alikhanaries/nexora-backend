import { z } from 'zod';
import { externalOrderSchema } from './compatibility-order.schemas.js';

const channelAddressSchema = z.object({
    Line1: z.string().nullable().optional(),
    Line2: z.string().nullable().optional(),
    Line3: z.string().nullable().optional(),
    City: z.string().nullable().optional(),
    Region: z.string().nullable().optional(),
    ZipCode: z.string().nullable().optional(),
    CountryIso: z.string().nullable().optional(),
    FirstName: z.string().nullable().optional(),
    LastName: z.string().nullable().optional(),
    CompanyName: z.string().nullable().optional(),
    StreetName: z.string().nullable().optional(),
    HouseNr: z.string().nullable().optional(),
    HouseNrAddition: z.string().nullable().optional(),
});

const channelShippingAddressSchema = channelAddressSchema.extend({
    ShippingAddressNote: z.string().nullable().optional(),
    PickupPointNumber: z.string().nullable().optional(),
    PickupPointName: z.string().nullable().optional(),
    AddressType: z.string().nullable().optional(),
});

const channelOrderLineRequestSchema = z.object({
    ChannelProductNo: z.string().nullable().optional(),
    MerchantProductNo: z.string().nullable().optional(),
    Quantity: z.union([z.number().int(), z.string()]),
    UnitPriceInclVat: z.union([z.number(), z.string()]),
    ExtraData: z.record(z.string()).nullable().optional(),
});

export const createChannelOrderBodySchema = z.object({
    BillingAddress: channelAddressSchema,
    ShippingAddress: channelShippingAddressSchema,
    ChannelOrderNo: z.string().min(1).max(60),
    Lines: z.array(channelOrderLineRequestSchema).min(1),
    ShippingCostsInclVat: z.union([z.number(), z.string()]),
    Email: z.string().min(1),
    CurrencyCode: z.string().min(3).max(3),
    OrderDate: z.string().min(1),
    Phone: z.string().nullable().optional(),
    ShippingMethod: z.string().nullable().optional(),
    ShippingServiceLevel: z.string().nullable().optional(),
    CommercialOrderNo: z.string().nullable().optional(),
    IsBusinessOrder: z.boolean().nullable().optional(),
    KeyIsMerchantProductNo: z.boolean().optional(),
    OrderFee: z.union([z.number(), z.string()]).nullable().optional(),
});

export const externalChannelOrderCreateSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(201),
    Content: externalOrderSchema,
});
