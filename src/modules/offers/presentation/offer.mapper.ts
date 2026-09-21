import type { OfferDto } from '../application/offer-dto.js';
import type { offerResponseSchema } from './offer.schemas.js';
import type { z } from 'zod';

export type OfferResponse = z.infer<typeof offerResponseSchema>;

export function toOfferResponse(offer: OfferDto): OfferResponse {
  return {
    id: offer.id,
    tenantId: offer.tenantId,
    productId: offer.productId,
    channelId: offer.channelId,
    status: offer.status,
    externalReference: offer.externalReference,
    priceReference: offer.priceReference,
    listingStatus: offer.listingStatus,
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}
