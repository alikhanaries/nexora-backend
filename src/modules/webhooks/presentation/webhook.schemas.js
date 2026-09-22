import { z } from 'zod';
import { WebhookDeliveryStatus } from '../domain/webhook-delivery-status.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';

export const webhookIdParamsSchema = z.object({
    webhookId: z.string().uuid(),
});

export const webhookDeliveryParamsSchema = z.object({
    webhookId: z.string().uuid(),
    deliveryId: z.string().uuid(),
});

export const createWebhookBodySchema = z.object({
    url: z.string().url().max(2048),
    description: z.string().max(512).nullable().optional(),
    eventTypes: z.array(z.string().min(1)).min(1),
});

export const updateWebhookBodySchema = z.object({
    url: z.string().url().max(2048).optional(),
    description: z.string().max(512).nullable().optional(),
    eventTypes: z.array(z.string().min(1)).min(1).optional(),
    status: z.enum([
        WebhookSubscriptionStatus.ACTIVE,
        WebhookSubscriptionStatus.DISABLED,
    ]).optional(),
}).refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
});

export const listWebhooksQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    status: z.enum([
        WebhookSubscriptionStatus.ACTIVE,
        WebhookSubscriptionStatus.DISABLED,
        WebhookSubscriptionStatus.DELETED,
    ]).optional(),
});

export const listWebhookDeliveriesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    status: z.enum([
        WebhookDeliveryStatus.PENDING,
        WebhookDeliveryStatus.DELIVERING,
        WebhookDeliveryStatus.DELIVERED,
        WebhookDeliveryStatus.FAILED,
        WebhookDeliveryStatus.DEAD_LETTERED,
    ]).optional(),
    eventType: z.string().min(1).optional(),
});

export const webhookSubscriptionResponseSchema = z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    description: z.string().nullable(),
    eventTypes: z.array(z.string()),
    status: z.enum([
        WebhookSubscriptionStatus.ACTIVE,
        WebhookSubscriptionStatus.DISABLED,
        WebhookSubscriptionStatus.DELETED,
    ]),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const webhookDeliveryResponseSchema = z.object({
    id: z.string().uuid(),
    eventId: z.string().uuid(),
    eventType: z.string(),
    status: z.enum([
        WebhookDeliveryStatus.PENDING,
        WebhookDeliveryStatus.DELIVERING,
        WebhookDeliveryStatus.DELIVERED,
        WebhookDeliveryStatus.FAILED,
        WebhookDeliveryStatus.DEAD_LETTERED,
    ]),
    attemptCount: z.number().int(),
    nextAttemptAt: z.string().nullable(),
    lastHttpStatus: z.number().int().nullable(),
    lastError: z.string().nullable(),
    deliveredAt: z.string().nullable(),
    createdAt: z.string(),
});

export const webhookSubscriptionSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: webhookSubscriptionResponseSchema,
});

export const webhookSubscriptionListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(webhookSubscriptionResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});

export const webhookCreateSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: webhookSubscriptionResponseSchema.extend({
        secret: z.string(),
    }),
});

export const webhookRotateSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        subscription: webhookSubscriptionResponseSchema,
        secret: z.string(),
    }),
});

export const webhookDeliverySuccessResponseSchema = z.object({
    success: z.literal(true),
    data: webhookDeliveryResponseSchema,
});

export const webhookDeliveryListSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items: z.array(webhookDeliveryResponseSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
    }),
});

export const webhookDeleteSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({ deleted: z.literal(true) }),
});
