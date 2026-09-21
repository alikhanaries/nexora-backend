import type { z } from 'zod';
import type { Marketplace } from '../domain/marketplace.js';
import type { marketplaceResponseSchema } from './marketplace.schemas.js';

export type MarketplaceResponse = z.infer<typeof marketplaceResponseSchema>;

export function toMarketplaceResponse(marketplace: Marketplace): MarketplaceResponse {
  return {
    id: marketplace.id,
    key: marketplace.key,
    name: marketplace.name,
    status: marketplace.status,
    createdAt: marketplace.createdAt.toISOString(),
    updatedAt: marketplace.updatedAt.toISOString(),
  };
}
