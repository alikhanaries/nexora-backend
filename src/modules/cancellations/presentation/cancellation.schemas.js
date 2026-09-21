import { z } from 'zod';
import { CancellationStatus } from '../domain/cancellation-status.js';
export const cancellationIdParamsSchema = z.object({
    cancellationId: z.string().uuid(),
});
export const orderIdParamsSchema = z.object({
    orderId: z.string().uuid(),
});
export const cancellationLineBodySchema = z.object({
    orderLineId: z.string().uuid(),
    quantity: z.number().int().positive(),
});
export const createCancellationBodySchema = z.object({
    orderId: z.string().uuid(),
    reason: z.string().max(1024).nullable().optional(),
    lines: z.array(cancellationLineBodySchema).optional(),
});
export const cancelOrderBodySchema = z.object({
    reason: z.string().max(1024).nullable().optional(),
    lines: z.array(cancellationLineBodySchema).optional(),
});
export const listCancellationsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    orderId: z.string().uuid().optional(),
    status: z
        .enum([CancellationStatus.REQUESTED, CancellationStatus.COMPLETED, CancellationStatus.REJECTED])
        .optional(),
});
export const cancellationLineResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    cancellationId: z.string().uuid(),
    orderLineId: z.string().uuid(),
    quantity: z.number().int().positive(),
    createdAt: z.string().datetime(),
});
export const cancellationResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    orderId: z.string().uuid(),
    status: z.enum([
        CancellationStatus.REQUESTED,
        CancellationStatus.COMPLETED,
        CancellationStatus.REJECTED,
    ]),
    reason: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    lines: z.array(cancellationLineResponseSchema).optional(),
});
export const cancellationSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: cancellationResponseSchema,
});
export const cancellationListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(cancellationResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});
