import { z } from 'zod';
import { MarketplaceOrderLifecycleOperation } from '../domain/marketplace-order-lifecycle-operation.js';
import { MarketplaceLifecycleJobSource } from '../domain/marketplace-lifecycle-job-source.js';
import { normalizedMarketplaceLifecycleCommandSchema } from './normalized-marketplace-lifecycle-command.schema.js';
import { normalizedMarketplaceWebhookEventSchema } from '../../marketplace-webhook-ingestion/application/normalized-marketplace-webhook-event.schema.js';

const jobBaseSchema = z.object({
    tenantId: z.string().uuid(),
    channelId: z.string().uuid(),
    marketplaceKey: z.string().min(1).max(64),
    externalOrderId: z.string().min(1).max(256),
    externalEventId: z.string().min(1).max(256),
    operation: z.string().min(1).max(64),
    source: z.enum([
        MarketplaceLifecycleJobSource.WEBHOOK,
        MarketplaceLifecycleJobSource.POLLING,
        MarketplaceLifecycleJobSource.OUTBOUND,
        MarketplaceLifecycleJobSource.MANUAL,
    ]),
    correlationId: z.string().min(1).max(128).nullable().optional(),
    receivedAt: z.string().datetime().optional(),
    causationId: z.string().min(1).max(128).optional(),
});

export const marketplaceLifecycleWebhookJobSchema = jobBaseSchema.extend({
    processingKind: z.literal('webhook_event'),
    webhookEvent: normalizedMarketplaceWebhookEventSchema,
});

export const marketplaceLifecycleInboundCommandJobSchema = jobBaseSchema.extend({
    processingKind: z.literal('inbound_lifecycle_command'),
    command: normalizedMarketplaceLifecycleCommandSchema,
});

export const marketplaceLifecycleOutboundJobSchema = jobBaseSchema.extend({
    processingKind: z.literal('outbound_lifecycle'),
    idempotencyKey: z.string().min(1).max(512),
    lifecycleOperation: z.enum([
        MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
        MarketplaceOrderLifecycleOperation.REFUND_ORDER,
        MarketplaceOrderLifecycleOperation.FULFILL_ORDER,
        MarketplaceOrderLifecycleOperation.RETURN_ORDER,
    ]),
    outboundPayload: z.unknown().optional(),
});

export const marketplaceLifecycleJobSchema = z.discriminatedUnion('processingKind', [
    marketplaceLifecycleWebhookJobSchema,
    marketplaceLifecycleInboundCommandJobSchema,
    marketplaceLifecycleOutboundJobSchema,
]);

/** @typedef {z.infer<typeof marketplaceLifecycleJobSchema>} MarketplaceLifecycleJob */
