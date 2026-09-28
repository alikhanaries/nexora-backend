import { z } from 'zod';
import { externalOrderCollectionSchema, externalOrderSchema } from './compatibility-order.schemas.js';

const stockConnectCeOrderLineSchema = z.object({
    ExtraData: z.array(z.unknown()).optional(),
}).passthrough();

export const stockConnectCeOrderSchema = externalOrderSchema
    .extend({
        ChannelId: z.number().int().optional(),
        GlobalChannelId: z.number().int().optional(),
        GlobalChannelName: z.string().nullable().optional(),
        Lines: z.array(stockConnectCeOrderLineSchema).nullable().optional(),
    })
    .passthrough();

export const stockConnectCeOrderCollectionSchema = externalOrderCollectionSchema.extend({
    Content: z.array(stockConnectCeOrderSchema).nullable(),
});
