import { z } from 'zod';
import { ChannelStatus } from '../domain/channel-status.js';

export const channelIdParamsSchema = z.object({
  channelId: z.string().uuid(),
});

export const createChannelBodySchema = z.object({
  marketplaceId: z.string().uuid(),
  name: z.string().min(1).max(256),
  externalReference: z.string().max(256).nullable().optional(),
  configurationReference: z.string().max(512).nullable().optional(),
});

export const updateChannelBodySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    externalReference: z.string().max(256).nullable().optional(),
    configurationReference: z.string().max(512).nullable().optional(),
    status: z
      .enum([ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.SUSPENDED])
      .optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.externalReference !== undefined ||
      body.configurationReference !== undefined ||
      body.status !== undefined,
    { message: 'At least one field must be provided' },
  );

export const listChannelsQuerySchema = z.object({
  status: z
    .enum([ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.SUSPENDED])
    .optional(),
  marketplaceId: z.string().uuid().optional(),
});

export const channelResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  marketplaceId: z.string().uuid(),
  name: z.string(),
  externalReference: z.string().nullable(),
  status: z.enum([ChannelStatus.ACTIVE, ChannelStatus.INACTIVE, ChannelStatus.SUSPENDED]),
  configurationReference: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const channelSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: channelResponseSchema,
});

export const channelListSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(channelResponseSchema),
});
