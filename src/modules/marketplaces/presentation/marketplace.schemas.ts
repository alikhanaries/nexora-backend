import { z } from 'zod';
import { MarketplaceStatus } from '../domain/marketplace-status.js';

export const marketplaceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createMarketplaceBodySchema = z.object({
  key: z.string().min(1).max(63),
  name: z.string().min(1).max(256),
});

export const updateMarketplaceBodySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    status: z.enum([MarketplaceStatus.ACTIVE, MarketplaceStatus.INACTIVE]).optional(),
  })
  .refine((body) => body.name !== undefined || body.status !== undefined, {
    message: 'At least one field must be provided',
  });

export const listMarketplacesQuerySchema = z.object({
  status: z.enum([MarketplaceStatus.ACTIVE, MarketplaceStatus.INACTIVE]).optional(),
});

export const marketplaceResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  status: z.enum([MarketplaceStatus.ACTIVE, MarketplaceStatus.INACTIVE]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketplaceSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: marketplaceResponseSchema,
});

export const marketplaceListSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(marketplaceResponseSchema),
});
