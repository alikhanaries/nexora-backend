import { z } from 'zod';
import { MarketplaceWebhookEventKind } from '../domain/marketplace-webhook-event-kind.js';
import { normalizedMarketplaceOrderSchema } from '../../marketplace-order-ingestion/public/normalized-marketplace-order.schema.js';

const orderResourceSchema = z.object({
    type: z.literal('order'),
    order: normalizedMarketplaceOrderSchema,
});

export const normalizedMarketplaceWebhookEventSchema = z.object({
    deduplicationKey: z.string().min(1).max(512),
    eventKind: z.enum([
        MarketplaceWebhookEventKind.ORDER_CREATE,
        MarketplaceWebhookEventKind.ORDER_UPDATE,
    ]),
    marketplaceKey: z.string().min(1).max(64),
    resource: orderResourceSchema,
});

/** @typedef {z.infer<typeof normalizedMarketplaceWebhookEventSchema>} NormalizedMarketplaceWebhookEvent */
