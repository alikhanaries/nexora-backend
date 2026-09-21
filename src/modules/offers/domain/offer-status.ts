export const OfferStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];
