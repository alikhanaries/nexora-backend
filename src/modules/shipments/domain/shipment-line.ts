export interface ShipmentLineProps {
  readonly id: string;
  readonly tenantId: string;
  readonly shipmentId: string;
  readonly orderLineId: string;
  readonly quantity: number;
  readonly createdAt: Date;
}

export class ShipmentLine {
  private constructor(private readonly props: ShipmentLineProps) {}

  static create(props: Omit<ShipmentLineProps, 'createdAt'> & { createdAt?: Date }): ShipmentLine {
    return new ShipmentLine({
      ...props,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static reconstitute(props: ShipmentLineProps): ShipmentLine {
    return new ShipmentLine(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get shipmentId(): string {
    return this.props.shipmentId;
  }

  get orderLineId(): string {
    return this.props.orderLineId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toProps(): ShipmentLineProps {
    return { ...this.props };
  }
}
