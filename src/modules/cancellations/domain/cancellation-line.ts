export interface CancellationLineProps {
  readonly id: string;
  readonly tenantId: string;
  readonly cancellationId: string;
  readonly orderLineId: string;
  readonly quantity: number;
  readonly createdAt: Date;
}

export class CancellationLine {
  private constructor(private readonly props: CancellationLineProps) {}

  static create(
    props: Omit<CancellationLineProps, 'createdAt'> & { createdAt?: Date },
  ): CancellationLine {
    return new CancellationLine({
      ...props,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static reconstitute(props: CancellationLineProps): CancellationLine {
    return new CancellationLine(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get cancellationId(): string {
    return this.props.cancellationId;
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

  toProps(): CancellationLineProps {
    return { ...this.props };
  }
}
