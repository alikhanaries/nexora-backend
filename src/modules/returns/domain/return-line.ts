export interface ReturnLineProps {
  readonly id: string;
  readonly tenantId: string;
  readonly returnId: string;
  readonly orderLineId: string;
  readonly quantity: number;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class ReturnLine {
  private constructor(private readonly props: ReturnLineProps) {}

  static create(
    props: Omit<ReturnLineProps, 'createdAt' | 'updatedAt'> & {
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): ReturnLine {
    const now = props.createdAt ?? new Date();
    return new ReturnLine({
      ...props,
      createdAt: now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  static reconstitute(props: ReturnLineProps): ReturnLine {
    return new ReturnLine(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get returnId(): string {
    return this.props.returnId;
  }

  get orderLineId(): string {
    return this.props.orderLineId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get reason(): string | null {
    return this.props.reason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProps(): ReturnLineProps {
    return { ...this.props };
  }
}
