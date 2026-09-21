export const ShipmentStatus = {
  CREATED: 'CREATED',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

const LEGAL_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  [ShipmentStatus.CREATED]: [
    ShipmentStatus.READY_TO_SHIP,
    ShipmentStatus.SHIPPED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.READY_TO_SHIP]: [ShipmentStatus.SHIPPED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.SHIPPED]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.FAILED,
  ],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.FAILED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

export function canTransitionShipmentStatus(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function assertShipmentTransition(from: ShipmentStatus, to: ShipmentStatus): void {
  if (!canTransitionShipmentStatus(from, to)) {
    throw new Error(`Invalid shipment status transition from ${from} to ${to}`);
  }
}

export function isShipmentCancellable(status: ShipmentStatus): boolean {
  return status === ShipmentStatus.CREATED || status === ShipmentStatus.READY_TO_SHIP;
}
