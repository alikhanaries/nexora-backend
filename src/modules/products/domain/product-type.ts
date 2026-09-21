export const ProductType = {
  STANDARD: 'STANDARD',
  BUNDLE: 'BUNDLE',
  VARIANT: 'VARIANT',
} as const;

export type ProductType = (typeof ProductType)[keyof typeof ProductType];
