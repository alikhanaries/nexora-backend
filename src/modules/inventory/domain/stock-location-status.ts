export const StockLocationStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type StockLocationStatus = (typeof StockLocationStatus)[keyof typeof StockLocationStatus];
