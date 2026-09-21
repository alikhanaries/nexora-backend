import type { z } from 'zod';
import type { Channel } from '../domain/channel.js';
import type { channelResponseSchema } from './channel.schemas.js';

export type ChannelResponse = z.infer<typeof channelResponseSchema>;

export function toChannelResponse(channel: Channel): ChannelResponse {
  return {
    id: channel.id,
    tenantId: channel.tenantId,
    marketplaceId: channel.marketplaceId,
    name: channel.name,
    externalReference: channel.externalReference,
    status: channel.status,
    configurationReference: channel.configurationReference,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}
