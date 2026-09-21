import { BusinessRuleError } from '../../../shared/errors/index.js';

export interface InventoryBalanceProps {
  readonly id: string;
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class InventoryBalance {
  readonly id: string;
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: InventoryBalanceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.stockLocationId = props.stockLocationId;
    this.productId = props.productId;
    this.onHand = props.onHand;
    this.reserved = props.reserved;
    this.available = props.available;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static reconstitute(props: InventoryBalanceProps): InventoryBalance {
    return new InventoryBalance(props);
  }

  static assertInvariant(onHand: number, reserved: number, available: number): void {
    if (available !== onHand - reserved) {
      throw new BusinessRuleError(
        'Inventory invariant violated: available must equal on_hand - reserved',
      );
    }
    if (onHand < 0 || reserved < 0 || available < 0) {
      throw new BusinessRuleError('Inventory quantities cannot be negative');
    }
    if (reserved > onHand) {
      throw new BusinessRuleError('Reserved quantity cannot exceed on-hand quantity');
    }
  }
}
