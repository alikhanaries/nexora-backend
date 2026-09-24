import { z } from 'zod';

export const marketplaceConnectionBodySchema = z.object({
    credentials: z.record(z.unknown()),
    configuration: z.record(z.unknown()).optional(),
});

export const marketplaceConnectionPatchBodySchema = z.object({
    credentials: z.record(z.unknown()).optional(),
    configuration: z.record(z.unknown()).optional(),
});

export const marketplaceConnectionResponseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    channelId: z.string().uuid(),
    marketplaceKey: z.string(),
    configuration: z.record(z.unknown()),
    status: z.enum(['ACTIVE', 'DISABLED']),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const marketplaceConnectionSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: marketplaceConnectionResponseSchema,
});

export const marketplaceConnectionDeleteSuccessResponseSchema = z.object({
    success: z.literal(true),
});

export const marketplaceConnectionTestSuccessResponseSchema = z.object({
    success: z.literal(true),
});
