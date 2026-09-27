import { z } from 'zod';
import { MarketplaceWebhookEventKind } from '../domain/marketplace-webhook-event-kind.js';
import { normalizedMarketplaceOrderSchema } from '../../marketplace-order-ingestion/public/normalized-marketplace-order.schema.js';

const orderCreateResourceSchema = z.object({
    type: z.literal('order'),
    order: normalizedMarketplaceOrderSchema,
});

const orderUpdateResourceSchema = z.union([
    z.object({
        type: z.literal('order'),
        lifecyclePayload: z.unknown(),
    }),
    z.object({
        type: z.literal('order'),
        order: normalizedMarketplaceOrderSchema,
    }),
]);

const webhookEventBaseSchema = z.object({
    deduplicationKey: z.string().min(1).max(512),
    marketplaceKey: z.string().min(1).max(64),
    providerEventId: z.string().min(1).max(256).optional(),
    providerTopic: z.string().min(1).max(128).optional(),
});

export const normalizedMarketplaceWebhookEventSchema = z.discriminatedUnion('eventKind', [
    webhookEventBaseSchema.extend({
        eventKind: z.literal(MarketplaceWebhookEventKind.ORDER_CREATE),
        resource: orderCreateResourceSchema,
    }),
    webhookEventBaseSchema.extend({
        eventKind: z.literal(MarketplaceWebhookEventKind.ORDER_UPDATE),
        resource: orderUpdateResourceSchema,
    }),
]);

/** @typedef {z.infer<typeof normalizedMarketplaceWebhookEventSchema>} NormalizedMarketplaceWebhookEvent */
