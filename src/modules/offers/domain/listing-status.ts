export const ListingStatus = {
  UNLISTED: 'UNLISTED',
  LISTED: 'LISTED',
  DELISTED: 'DELISTED',
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];
