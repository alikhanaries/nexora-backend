import { z } from 'zod';

export const stockConnectListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  merchantSku: z.string().min(1).max(128).optional(),
});

export const stockConnectProductCreateBodySchema = z.object({
  merchantSku: z.string().min(1).max(128),
  externalReference: z.string().max(256).nullable().optional(),
  productType: z.enum(['STANDARD', 'BUNDLE', 'VARIANT']).optional(),
});

export const stockConnectProductPatchBodySchema = z
  .object({
    externalReference: z.string().max(256).nullable().optional(),
    productType: z.enum(['STANDARD', 'BUNDLE', 'VARIANT']).optional(),
  })
  .refine(
    (body) => body.externalReference !== undefined || body.productType !== undefined,
    { message: 'At least one field must be provided' },
  );

export const stockConnectPublishBodySchema = z.object({
  channelId: z.string().uuid(),
});

export const stockConnectInventoryAdjustBodySchema = z.object({
  productId: z.string().uuid(),
  stockLocationId: z.string().uuid(),
  quantityDelta: z.number().int(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const stockConnectOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  channelId: z.string().uuid().optional(),
});

export const stockConnectOrdersSyncQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
});

export const stockConnectCancelOrderBodySchema = z.object({
  reason: z.string().max(512).optional(),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .optional(),
});

export const stockConnectCreateShipmentBodySchema = z.object({
  carrier: z.string().max(256).nullable().optional(),
  service: z.string().max(256).nullable().optional(),
  trackingNumber: z.string().max(256).nullable().optional(),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const stockConnectShipShipmentBodySchema = z.object({
  carrier: z.string().max(256).nullable().optional(),
  service: z.string().max(256).nullable().optional(),
  trackingNumber: z.string().max(256).nullable().optional(),
});

export const stockConnectIdParamsSchema = z.object({
  productId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  shipmentId: z.string().uuid().optional(),
});
