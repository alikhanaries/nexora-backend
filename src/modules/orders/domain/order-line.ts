import {
  OrderLineStatus,
  type OrderLineStatus as OrderLineStatusType,
} from './order-line-status.js';

export interface OrderLineProps {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly offerId: string | null;
  readonly stockLocationId: string;
  readonly merchantSku: string;
  readonly productTypeSnapshot: string;
  readonly quantity: number;
  readonly cancelledQuantity: number;
  readonly shippedQuantity: number;
  readonly returnedQuantity: number;
  readonly unitPriceMinor: number;
  readonly discountMinor: number;
  readonly taxMinor: number;
  readonly lineTotalMinor: number;
  readonly currency: string;
  readonly status: OrderLineStatusType;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class OrderLine {
  private constructor(private readonly props: OrderLineProps) {}

  static create(
    props: Omit<
      OrderLineProps,
      | 'cancelledQuantity'
      | 'shippedQuantity'
      | 'returnedQuantity'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
    > & {
      cancelledQuantity?: number;
      shippedQuantity?: number;
      returnedQuantity?: number;
      status?: OrderLineStatusType;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): OrderLine {
    const now = props.createdAt ?? new Date();
    return new OrderLine({
      ...props,
      cancelledQuantity: props.cancelledQuantity ?? 0,
      shippedQuantity: props.shippedQuantity ?? 0,
      returnedQuantity: props.returnedQuantity ?? 0,
      status: props.status ?? OrderLineStatus.OPEN,
      createdAt: now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  static reconstitute(props: OrderLineProps): OrderLine {
    return new OrderLine(props);
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

  get productId(): string {
    return this.props.productId;
  }

  get offerId(): string | null {
    return this.props.offerId;
  }

  get stockLocationId(): string {
    return this.props.stockLocationId;
  }

  get merchantSku(): string {
    return this.props.merchantSku;
  }

  get productTypeSnapshot(): string {
    return this.props.productTypeSnapshot;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get cancelledQuantity(): number {
    return this.props.cancelledQuantity;
  }

  get shippedQuantity(): number {
    return this.props.shippedQuantity;
  }

  get returnedQuantity(): number {
    return this.props.returnedQuantity;
  }

  get unitPriceMinor(): number {
    return this.props.unitPriceMinor;
  }

  get discountMinor(): number {
    return this.props.discountMinor;
  }

  get taxMinor(): number {
    return this.props.taxMinor;
  }

  get lineTotalMinor(): number {
    return this.props.lineTotalMinor;
  }

  get currency(): string {
    return this.props.currency;
  }

  get status(): OrderLineStatusType {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  cancellableQuantity(): number {
    return this.props.quantity - this.props.cancelledQuantity - this.props.shippedQuantity;
  }

  shippableQuantity(): number {
    return this.props.quantity - this.props.cancelledQuantity - this.props.shippedQuantity;
  }

  returnableQuantity(): number {
    return this.props.shippedQuantity - this.props.returnedQuantity;
  }

  withUpdatedQuantities(
    patch: Partial<
      Pick<
        OrderLineProps,
        'cancelledQuantity' | 'shippedQuantity' | 'returnedQuantity' | 'status' | 'updatedAt'
      >
    >,
  ): OrderLine {
    return new OrderLine({
      ...this.props,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date(),
    });
  }

  toProps(): OrderLineProps {
    return { ...this.props };
  }
}
