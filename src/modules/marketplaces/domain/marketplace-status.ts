export const MarketplaceStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type MarketplaceStatus = (typeof MarketplaceStatus)[keyof typeof MarketplaceStatus];
