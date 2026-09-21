import type { Offer } from '../domain/offer.js';
import type { ListingStatus } from '../domain/listing-status.js';
import type { OfferStatus } from '../domain/offer-status.js';

export interface OfferDto {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly channelId: string;
  readonly status: OfferStatus;
  readonly externalReference: string | null;
  readonly priceReference: string | null;
  readonly listingStatus: ListingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function toOfferDto(offer: Offer): OfferDto {
  return {
    id: offer.id,
    tenantId: offer.tenantId,
    productId: offer.productId,
    channelId: offer.channelId,
    status: offer.status,
    externalReference: offer.externalReference,
    priceReference: offer.priceReference,
    listingStatus: offer.listingStatus,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}
