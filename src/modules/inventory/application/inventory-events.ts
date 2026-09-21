export const INVENTORY_EVENT_TYPES = {
  INVENTORY_CHANGED: 'inventory.inventory_changed',
  INVENTORY_RESERVED: 'inventory.inventory_reserved',
  INVENTORY_RELEASED: 'inventory.inventory_released',
} as const;

export const INVENTORY_EVENT_VERSION = 1;

export const INVENTORY_AGGREGATE_TYPE = 'inventory_balance';
