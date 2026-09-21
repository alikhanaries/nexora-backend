import { BusinessRuleError } from '../../../shared/errors/index.js';
import {
  assertShipmentTransition,
  isShipmentCancellable,
  ShipmentStatus,
  type ShipmentStatus as ShipmentStatusType,
} from './shipment-status.js';

export interface ShipmentProps {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly carrier: string | null;
  readonly service: string | null;
  readonly trackingNumber: string | null;
  readonly status: ShipmentStatusType;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Shipment {
  private constructor(private readonly props: ShipmentProps) {}

  static create(
    props: Omit<
      ShipmentProps,
      'status' | 'shippedAt' | 'deliveredAt' | 'createdAt' | 'updatedAt'
    > & {
      status?: ShipmentStatusType;
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Shipment {
    const now = props.createdAt ?? new Date();
    return new Shipment({
      ...props,
      status: props.status ?? ShipmentStatus.CREATED,
      shippedAt: props.shippedAt ?? null,
      deliveredAt: props.deliveredAt ?? null,
      createdAt: now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  static reconstitute(props: ShipmentProps): Shipment {
    return new Shipment(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get carrier(): string | null {
    return this.props.carrier;
  }

  get service(): string | null {
    return this.props.service;
  }

  get trackingNumber(): string | null {
    return this.props.trackingNumber;
  }

  get status(): ShipmentStatusType {
    return this.props.status;
  }

  get shippedAt(): Date | null {
    return this.props.shippedAt;
  }

  get deliveredAt(): Date | null {
    return this.props.deliveredAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  transitionTo(next: ShipmentStatusType, at: Date = new Date()): Shipment {
    assertShipmentTransition(this.props.status, next);
    return new Shipment({
      ...this.props,
      status: next,
      updatedAt: at,
      ...(next === ShipmentStatus.SHIPPED || next === ShipmentStatus.IN_TRANSIT
        ? { shippedAt: this.props.shippedAt ?? at }
        : {}),
      ...(next === ShipmentStatus.DELIVERED ? { deliveredAt: at } : {}),
    });
  }

  withCarrierDetails(
    patch: Partial<Pick<ShipmentProps, 'carrier' | 'service' | 'trackingNumber'>>,
    at: Date = new Date(),
  ): Shipment {
    return new Shipment({
      ...this.props,
      carrier: patch.carrier === undefined ? this.props.carrier : patch.carrier,
      service: patch.service === undefined ? this.props.service : patch.service,
      trackingNumber:
        patch.trackingNumber === undefined ? this.props.trackingNumber : patch.trackingNumber,
      updatedAt: at,
    });
  }

  ship(at: Date = new Date()): Shipment {
    if (
      this.props.status !== ShipmentStatus.CREATED &&
      this.props.status !== ShipmentStatus.READY_TO_SHIP
    ) {
      throw new BusinessRuleError('Only created or ready-to-ship shipments can be shipped', {
        status: this.props.status,
      });
    }
    return this.transitionTo(ShipmentStatus.SHIPPED, at);
  }

  deliver(at: Date = new Date()): Shipment {
    if (
      this.props.status !== ShipmentStatus.SHIPPED &&
      this.props.status !== ShipmentStatus.IN_TRANSIT
    ) {
      throw new BusinessRuleError('Only shipped or in-transit shipments can be delivered', {
        status: this.props.status,
      });
    }
    return this.transitionTo(ShipmentStatus.DELIVERED, at);
  }

  cancel(at: Date = new Date()): Shipment {
    if (!isShipmentCancellable(this.props.status)) {
      throw new BusinessRuleError('Shipment cannot be cancelled in its current status', {
        status: this.props.status,
      });
    }
    return this.transitionTo(ShipmentStatus.CANCELLED, at);
  }

  toProps(): ShipmentProps {
    return { ...this.props };
  }
}
