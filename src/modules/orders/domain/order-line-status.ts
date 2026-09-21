export const OrderLineStatus = {
  OPEN: 'OPEN',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const;

export type OrderLineStatus = (typeof OrderLineStatus)[keyof typeof OrderLineStatus];
