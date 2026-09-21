import { z } from 'zod';
import { ReturnStatus } from '../domain/return-status.js';
export const returnIdParamsSchema = z.object({
    returnId: z.string().uuid(),
});
export const orderIdParamsSchema = z.object({
    orderId: z.string().uuid(),
});
export const createReturnLineBodySchema = z.object({
    orderLineId: z.string().uuid(),
    quantity: z.number().int().positive(),
    reason: z.string().max(512).nullable().optional(),
});
export const createReturnBodySchema = z.object({
    lines: z.array(createReturnLineBodySchema).min(1),
    shipmentId: z.string().uuid().nullable().optional(),
    reason: z.string().max(512).nullable().optional(),
});
export const listReturnsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    orderId: z.string().uuid().optional(),
    status: z
        .enum([
        ReturnStatus.REQUESTED,
        ReturnStatus.APPROVED,
        ReturnStatus.RECEIVED,
        ReturnStatus.COMPLETED,
        ReturnStatus.REJECTED,
        ReturnStatus.CANCELLED,
    ])
        .optional(),
});
export const returnLineResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    returnId: z.string().uuid(),
    orderLineId: z.string().uuid(),
    quantity: z.number().int(),
    reason: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const returnResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    orderId: z.string().uuid(),
    shipmentId: z.string().uuid().nullable(),
    status: z.enum([
        ReturnStatus.REQUESTED,
        ReturnStatus.APPROVED,
        ReturnStatus.RECEIVED,
        ReturnStatus.COMPLETED,
        ReturnStatus.REJECTED,
        ReturnStatus.CANCELLED,
    ]),
    reason: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    receivedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    lines: z.array(returnLineResponseSchema),
});
export const returnSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: returnResponseSchema,
});
export const returnListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(returnResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});
