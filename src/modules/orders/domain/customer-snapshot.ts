export interface AddressSnapshot {
  readonly line1?: string | null;
  readonly line2?: string | null;
  readonly city?: string | null;
  readonly region?: string | null;
  readonly postalCode?: string | null;
  readonly countryCode?: string | null;
}

export interface CustomerSnapshotProps {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly externalCustomerReference: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly companyName: string | null;
  readonly billingAddress: AddressSnapshot | null;
  readonly shippingAddress: AddressSnapshot | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export class CustomerSnapshot {
  private constructor(private readonly props: CustomerSnapshotProps) {}

  static create(
    props: Omit<CustomerSnapshotProps, 'createdAt'> & { createdAt?: Date },
  ): CustomerSnapshot {
    return new CustomerSnapshot({
      ...props,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static reconstitute(props: CustomerSnapshotProps): CustomerSnapshot {
    return new CustomerSnapshot(props);
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

  get externalCustomerReference(): string | null {
    return this.props.externalCustomerReference;
  }

  get firstName(): string | null {
    return this.props.firstName;
  }

  get lastName(): string | null {
    return this.props.lastName;
  }

  get email(): string | null {
    return this.props.email;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get companyName(): string | null {
    return this.props.companyName;
  }

  get billingAddress(): AddressSnapshot | null {
    return this.props.billingAddress;
  }

  get shippingAddress(): AddressSnapshot | null {
    return this.props.shippingAddress;
  }

  get metadata(): Readonly<Record<string, unknown>> {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toProps(): CustomerSnapshotProps {
    return { ...this.props };
  }
}
