import { z } from 'zod';
import { OrderStatus } from '../../../orders/models/order-status.js';
import { ProductStatus } from '../../../products/models/product-status.js';

export const stockConnectProductIdParamsSchema = z.object({
  productId: z.string().uuid(),
});

export const stockConnectOrderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

export const stockConnectListProductsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
  status: z
    .enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.ARCHIVED])
    .optional(),
  merchantSku: z.string().max(256).optional(),
});

export const stockConnectUpsertProductBodySchema = z
  .object({
    merchantSku: z.string().min(1).max(256),
    externalReference: z.string().max(256).nullable().optional(),
    productType: z.string().max(64).optional(),
  })
  .strict();

export const stockConnectUpdateProductBodySchema = z
  .object({
    externalReference: z.string().max(256).nullable().optional(),
    productType: z.string().max(64).optional(),
  })
  .strict()
  .refine((body) => body.externalReference !== undefined || body.productType !== undefined, {
    message: 'At least one field must be provided',
  });

export const stockConnectPublishProductBodySchema = z
  .object({
    channelId: z.string().uuid(),
    offerId: z.string().uuid().optional(),
    resolvePricing: z.boolean().optional(),
    currency: z.string().length(3).optional(),
  })
  .strict();

export const stockConnectListOrdersQuerySchema = z.object({
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
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
});

export const stockConnectSyncOrdersQuerySchema = stockConnectListOrdersQuerySchema.extend({
  updatedAfter: z.string().datetime().optional(),
});

export const stockConnectInventoryQuerySchema = z.object({
  stockLocationId: z.string().uuid().optional(),
});

export const stockConnectAdjustInventoryBodySchema = z
  .object({
    productId: z.string().uuid(),
    stockLocationId: z.string().uuid(),
    quantityDelta: z.number().int(),
    reason: z.string().max(256).optional(),
  })
  .strict();

export const stockConnectCreateShipmentBodySchema = z
  .object({
    lines: z
      .array(
        z.object({
          orderLineId: z.string().uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(100),
    carrier: z.string().max(128).nullable().optional(),
    service: z.string().max(128).nullable().optional(),
    trackingNumber: z.string().max(256).nullable().optional(),
  })
  .strict();

export const stockConnectShipShipmentBodySchema = z
  .object({
    trackingNumber: z.string().max(256).nullable().optional(),
    carrier: z.string().max(128).nullable().optional(),
  })
  .strict();

export const stockConnectShipmentIdParamsSchema = z.object({
  shipmentId: z.string().uuid(),
});

export const stockConnectListCommerceIntegrationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
});
