import { BusinessRuleError } from '../../../shared/errors/index.js';
import type { ReservationStatus } from './reservation-status.js';
import { ReservationStatus as Status } from './reservation-status.js';

export interface InventoryReservationProps {
  readonly id: string;
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly quantity: number;
  readonly status: ReservationStatus;
  readonly createdAt: Date;
  readonly releasedAt: Date | null;
}

export class InventoryReservation {
  readonly id: string;
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly quantity: number;
  readonly status: ReservationStatus;
  readonly createdAt: Date;
  readonly releasedAt: Date | null;

  private constructor(props: InventoryReservationProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.stockLocationId = props.stockLocationId;
    this.productId = props.productId;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.quantity = props.quantity;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.releasedAt = props.releasedAt;
  }

  static reconstitute(props: InventoryReservationProps): InventoryReservation {
    return new InventoryReservation(props);
  }

  assertActive(): void {
    if (this.status !== Status.ACTIVE) {
      throw new BusinessRuleError('Reservation is not active', {
        reservationId: this.id,
        status: this.status,
      });
    }
  }

  isReleased(): boolean {
    return this.status === Status.RELEASED;
  }
}
