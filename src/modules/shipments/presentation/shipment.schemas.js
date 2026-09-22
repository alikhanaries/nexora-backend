import { z } from 'zod';
import { ShipmentStatus } from '../domain/shipment-status.js';
export const shipmentIdParamsSchema = z.object({
    shipmentId: z.string().uuid(),
});
export const orderIdParamsSchema = z.object({
    orderId: z.string().uuid(),
});
export const createShipmentLineBodySchema = z.object({
    orderLineId: z.string().uuid(),
    quantity: z.number().int().positive(),
});
export const createShipmentBodySchema = z.object({
    carrier: z.string().max(256).nullable().optional(),
    service: z.string().max(256).nullable().optional(),
    trackingNumber: z.string().max(256).nullable().optional(),
    lines: z.array(createShipmentLineBodySchema).min(1),
});
export const shipShipmentBodySchema = z.object({
    carrier: z.string().max(256).nullable().optional(),
    service: z.string().max(256).nullable().optional(),
    trackingNumber: z.string().max(256).nullable().optional(),
});
export const listShipmentsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    orderId: z.string().uuid().optional(),
    status: z
        .enum([
        ShipmentStatus.CREATED,
        ShipmentStatus.READY_TO_SHIP,
        ShipmentStatus.SHIPPED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
        ShipmentStatus.CANCELLED,
    ])
        .optional(),
    trackingNumber: z.string().max(256).optional(),
});
export const shipmentLineResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    shipmentId: z.string().uuid(),
    orderLineId: z.string().uuid(),
    quantity: z.number().int().positive(),
    createdAt: z.string().datetime(),
});
export const shipmentResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    orderId: z.string().uuid(),
    externalReference: z.string().nullable(),
    carrier: z.string().nullable(),
    service: z.string().nullable(),
    trackingNumber: z.string().nullable(),
    status: z.enum([
        ShipmentStatus.CREATED,
        ShipmentStatus.READY_TO_SHIP,
        ShipmentStatus.SHIPPED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
        ShipmentStatus.CANCELLED,
    ]),
    shippedAt: z.string().datetime().nullable(),
    deliveredAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const shipmentDetailResponseSchema = shipmentResponseSchema.extend({
    lines: z.array(shipmentLineResponseSchema),
});
export const shipmentSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: shipmentDetailResponseSchema,
});
export const shipmentListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(shipmentResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});
