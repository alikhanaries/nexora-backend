import { z } from 'zod';
import { externalOrderCollectionSchema, externalOrderSchema } from './compatibility-order.schemas.js';

const compatV2OrderLineSchema = z.object({
    ExtraData: z.array(z.unknown()).optional(),
}).passthrough();

export const compatV2OrderSchema = externalOrderSchema
    .extend({
        ChannelId: z.number().int().optional(),
        GlobalChannelId: z.number().int().optional(),
        GlobalChannelName: z.string().nullable().optional(),
        Lines: z.array(compatV2OrderLineSchema).nullable().optional(),
    })
    .passthrough();

export const compatV2OrderCollectionSchema = externalOrderCollectionSchema.extend({
    Content: z.array(compatV2OrderSchema).nullable(),
});
