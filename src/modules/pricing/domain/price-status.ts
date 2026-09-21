export const PriceStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type PriceStatus = (typeof PriceStatus)[keyof typeof PriceStatus];
