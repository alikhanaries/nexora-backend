import { z } from 'zod';
import { MarketplaceOrderLifecycleOperation } from '../domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../domain/normalized-marketplace-lifecycle-target-status.js';

const lifecycleLineSchema = z.object({
    merchantSku: z.string().min(1).max(128).optional(),
    externalLineId: z.string().min(1).max(256).optional(),
    quantity: z.number().int().positive(),
});

const lifecycleCommandBaseSchema = z.object({
    marketplaceKey: z.string().min(1).max(64),
    externalOrderId: z.string().min(1).max(256),
    externalEventId: z.string().min(1).max(256),
    occurredAt: z.string().datetime().optional(),
});

const updateOrderCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.UPDATE_ORDER),
    note: z.string().max(2000).optional(),
});

const cancelOrderCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.CANCEL_ORDER),
    reason: z.string().max(2000).optional(),
    lines: z.array(lifecycleLineSchema).optional(),
});

const returnOrderCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.RETURN_ORDER),
    reason: z.string().max(2000).optional(),
    lines: z.array(lifecycleLineSchema).min(1),
});

const refundOrderCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.REFUND_ORDER),
    lines: z.array(lifecycleLineSchema).optional(),
    refundMinor: z.number().int().nonnegative().optional(),
});

const fulfillOrderCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.FULFILL_ORDER),
    lines: z.array(lifecycleLineSchema).min(1),
    trackingNumber: z.string().max(256).optional(),
    carrierCode: z.string().max(64).optional(),
});

const shipmentUpdateCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.SHIPMENT_UPDATE),
    externalShipmentId: z.string().min(1).max(256).optional(),
    trackingNumber: z.string().max(256).optional(),
    carrierCode: z.string().max(64).optional(),
    lines: z.array(lifecycleLineSchema).optional(),
});

const statusSyncCommandSchema = lifecycleCommandBaseSchema.extend({
    operation: z.literal(MarketplaceOrderLifecycleOperation.STATUS_SYNC),
    targetStatus: z.enum([
        NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
        NormalizedMarketplaceLifecycleTargetStatus.CANCELLED,
        NormalizedMarketplaceLifecycleTargetStatus.FULFILLED,
        NormalizedMarketplaceLifecycleTargetStatus.RETURNED,
        NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN,
    ]),
});

export const normalizedMarketplaceLifecycleCommandSchema = z.discriminatedUnion('operation', [
    updateOrderCommandSchema,
    cancelOrderCommandSchema,
    returnOrderCommandSchema,
    refundOrderCommandSchema,
    fulfillOrderCommandSchema,
    shipmentUpdateCommandSchema,
    statusSyncCommandSchema,
]);
