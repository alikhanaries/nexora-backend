import { z } from 'zod';
import { NormalizedMarketplaceOrderStatus } from '../domain/normalized-marketplace-order-status.js';

const addressSchema = z.object({
    line1: z.string().nullable().optional(),
    line2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    countryCode: z.string().min(2).max(2).nullable().optional(),
}).strict();

const customerSchema = z.object({
    externalCustomerReference: z.string().min(1).nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    companyName: z.string().nullable().optional(),
    billingAddress: addressSchema.nullable().optional(),
    shippingAddress: addressSchema.nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
}).strict();

const externalEntityRefSchema = z.object({
    externalEntityType: z.string().min(1),
    externalEntityId: z.string().min(1),
}).strict();

const lineSchema = z.object({
    externalLineId: z.string().min(1).optional(),
    quantity: z.number().int().positive(),
    stockLocationId: z.string().uuid(),
    merchantSku: z.string().min(1).optional(),
    channelProductNo: z.string().min(1).optional(),
    marketplaceExternalEntity: externalEntityRefSchema.optional(),
    unitPriceMinor: z.number().int().nonnegative().optional(),
    lineTotalMinor: z.number().int().nonnegative().optional(),
    taxMinor: z.number().int().nonnegative().optional(),
    discountMinor: z.number().int().nonnegative().optional(),
}).strict().superRefine((line, ctx) => {
    const hasSku = line.merchantSku !== undefined ||
        line.channelProductNo !== undefined ||
        line.marketplaceExternalEntity !== undefined;
    if (!hasSku) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Line must include merchantSku, channelProductNo, or marketplaceExternalEntity',
        });
    }
});

export const normalizedMarketplaceOrderSchema = z.object({
    externalOrderId: z.string().min(1),
    externalOrderNumber: z.string().min(1).optional(),
    marketplaceKey: z.string().min(1),
    status: z.enum([
        NormalizedMarketplaceOrderStatus.PENDING,
        NormalizedMarketplaceOrderStatus.CONFIRMED,
        NormalizedMarketplaceOrderStatus.CANCELLED,
        NormalizedMarketplaceOrderStatus.FULFILLED,
        NormalizedMarketplaceOrderStatus.UNKNOWN,
    ]),
    currency: z.string().min(3).max(3),
    subtotalMinor: z.number().int().nonnegative().optional(),
    discountMinor: z.number().int().nonnegative().optional(),
    taxMinor: z.number().int().nonnegative().optional(),
    shippingMinor: z.number().int().nonnegative().optional(),
    totalMinor: z.number().int().nonnegative().optional(),
    customer: customerSchema.optional(),
    lines: z.array(lineSchema).min(1),
    metadata: z.record(z.unknown()).optional(),
}).strict();

/** @typedef {z.infer<typeof normalizedMarketplaceOrderSchema>} NormalizedMarketplaceOrder */
