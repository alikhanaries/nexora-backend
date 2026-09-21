export const MovementType = {
  RECEIPT: 'RECEIPT',
  ADJUSTMENT: 'ADJUSTMENT',
  RESERVATION: 'RESERVATION',
  RELEASE: 'RELEASE',
  SALE: 'SALE',
  RETURN: 'RETURN',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
} as const;

export type MovementType = (typeof MovementType)[keyof typeof MovementType];
