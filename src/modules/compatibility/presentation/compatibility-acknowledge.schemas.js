import { z } from 'zod';

const externalOrderIdSchema = z.union([
    z.string().regex(/^-?(?:0|[1-9]\d*)$/),
    z.number().int(),
]);

export const acknowledgeOrderBodySchema = z.object({
    MerchantOrderNo: z.string().min(1).max(60),
    OrderId: externalOrderIdSchema,
});

export const externalAcknowledgeSuccessSchema = z.object({
    Success: z.literal(true),
    StatusCode: z.literal(201),
    Message: z.string().nullable().optional(),
});
