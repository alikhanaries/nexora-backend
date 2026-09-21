import {
  assertOrderTransition,
  OrderStatus,
  type OrderStatus as OrderStatusType,
} from './order-status.js';

export interface OrderProps {
  readonly id: string;
  readonly tenantId: string;
  readonly channelId: string;
  readonly externalOrderReference: string | null;
  readonly orderNumber: string;
  readonly status: OrderStatusType;
  readonly currency: string;
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly taxMinor: number;
  readonly shippingMinor: number;
  readonly totalMinor: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly confirmedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
}

export class Order {
  private constructor(private readonly props: OrderProps) {}

  static create(
    props: Omit<
      OrderProps,
      | 'status'
      | 'confirmedAt'
      | 'cancelledAt'
      | 'shippedAt'
      | 'deliveredAt'
      | 'createdAt'
      | 'updatedAt'
    > & {
      status?: OrderStatusType;
      confirmedAt?: Date | null;
      cancelledAt?: Date | null;
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Order {
    const now = props.createdAt ?? new Date();
    return new Order({
      ...props,
      status: props.status ?? OrderStatus.CONFIRMED,
      confirmedAt: props.confirmedAt ?? now,
      cancelledAt: props.cancelledAt ?? null,
      shippedAt: props.shippedAt ?? null,
      deliveredAt: props.deliveredAt ?? null,
      createdAt: now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get channelId(): string {
    return this.props.channelId;
  }

  get externalOrderReference(): string | null {
    return this.props.externalOrderReference;
  }

  get orderNumber(): string {
    return this.props.orderNumber;
  }

  get status(): OrderStatusType {
    return this.props.status;
  }

  get currency(): string {
    return this.props.currency;
  }

  get subtotalMinor(): number {
    return this.props.subtotalMinor;
  }

  get discountMinor(): number {
    return this.props.discountMinor;
  }

  get taxMinor(): number {
    return this.props.taxMinor;
  }

  get shippingMinor(): number {
    return this.props.shippingMinor;
  }

  get totalMinor(): number {
    return this.props.totalMinor;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get confirmedAt(): Date | null {
    return this.props.confirmedAt;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get shippedAt(): Date | null {
    return this.props.shippedAt;
  }

  get deliveredAt(): Date | null {
    return this.props.deliveredAt;
  }

  transitionTo(next: OrderStatusType, at: Date = new Date()): Order {
    assertOrderTransition(this.props.status, next);
    return new Order({
      ...this.props,
      status: next,
      updatedAt: at,
      ...(next === OrderStatus.CONFIRMED ? { confirmedAt: at } : {}),
      ...(next === OrderStatus.CANCELLED ? { cancelledAt: at } : {}),
      ...(next === OrderStatus.SHIPPED ? { shippedAt: at } : {}),
      ...(next === OrderStatus.DELIVERED ? { deliveredAt: at } : {}),
    });
  }

  toProps(): OrderProps {
    return { ...this.props };
  }
}
