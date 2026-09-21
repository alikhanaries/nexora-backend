import { z } from 'zod';
import { OrderStatus } from '../domain/order-status.js';

const addressSchema = z
  .object({
    line1: z.string().max(256).nullable().optional(),
    line2: z.string().max(256).nullable().optional(),
    city: z.string().max(128).nullable().optional(),
    region: z.string().max(128).nullable().optional(),
    postalCode: z.string().max(32).nullable().optional(),
    countryCode: z.string().length(2).nullable().optional(),
  })
  .strict();

const customerSchema = z
  .object({
    externalCustomerReference: z.string().max(256).nullable().optional(),
    firstName: z.string().max(128).nullable().optional(),
    lastName: z.string().max(128).nullable().optional(),
    email: z.string().email().max(256).nullable().optional(),
    phone: z.string().max(64).nullable().optional(),
    companyName: z.string().max(256).nullable().optional(),
    billingAddress: addressSchema.nullable().optional(),
    shippingAddress: addressSchema.nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

const orderLineInputSchema = z.object({
  productId: z.string().uuid(),
  offerId: z.string().uuid().nullable().optional(),
  stockLocationId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createOrderBodySchema = z.object({
  channelId: z.string().uuid(),
  currency: z.string().length(3),
  lines: z.array(orderLineInputSchema).min(1).max(100),
  customer: customerSchema.optional(),
  externalOrderReference: z.string().max(256).nullable().optional(),
  discountMinor: z.number().int().nonnegative().optional(),
  taxMinor: z.number().int().nonnegative().optional(),
  shippingMinor: z.number().int().nonnegative().optional(),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

export const listOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
  status: z
    .enum([
      OrderStatus.NEW,
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.READY_TO_SHIP,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.RETURNED,
    ])
    .optional(),
  channelId: z.string().uuid().optional(),
  externalOrderReference: z.string().max(256).optional(),
  orderNumber: z.string().max(64).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

const orderResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  channelId: z.string().uuid(),
  externalOrderReference: z.string().nullable(),
  orderNumber: z.string(),
  status: z.string(),
  currency: z.string(),
  subtotalMinor: z.number().int(),
  discountMinor: z.number().int(),
  taxMinor: z.number().int(),
  shippingMinor: z.number().int(),
  totalMinor: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
});

const orderLineResponseSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  offerId: z.string().uuid().nullable(),
  stockLocationId: z.string().uuid(),
  merchantSku: z.string(),
  productTypeSnapshot: z.string(),
  quantity: z.number().int(),
  cancelledQuantity: z.number().int(),
  shippedQuantity: z.number().int(),
  returnedQuantity: z.number().int(),
  unitPriceMinor: z.number().int(),
  discountMinor: z.number().int(),
  taxMinor: z.number().int(),
  lineTotalMinor: z.number().int(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const orderDetailResponseSchema = orderResponseSchema.extend({
  lines: z.array(orderLineResponseSchema),
  customer: z
    .object({
      id: z.string().uuid(),
      externalCustomerReference: z.string().nullable(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      companyName: z.string().nullable(),
      billingAddress: z.record(z.unknown()).nullable(),
      shippingAddress: z.record(z.unknown()).nullable(),
      metadata: z.record(z.unknown()),
      createdAt: z.string(),
    })
    .nullable(),
});

export const orderSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: orderDetailResponseSchema,
});

export const orderListSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(orderResponseSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});
