import { BusinessRuleError } from '../../../shared/errors/index.js';
import {
  assertReturnTransition,
  ReturnStatus,
  type ReturnStatus as ReturnStatusType,
} from './return-status.js';

export interface ReturnProps {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly shipmentId: string | null;
  readonly status: ReturnStatusType;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly receivedAt: Date | null;
  readonly completedAt: Date | null;
}

export class Return {
  private constructor(private readonly props: ReturnProps) {}

  static create(
    props: Omit<
      ReturnProps,
      'status' | 'receivedAt' | 'completedAt' | 'createdAt' | 'updatedAt'
    > & {
      status?: ReturnStatusType;
      receivedAt?: Date | null;
      completedAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Return {
    const now = props.createdAt ?? new Date();
    return new Return({
      ...props,
      status: props.status ?? ReturnStatus.REQUESTED,
      receivedAt: props.receivedAt ?? null,
      completedAt: props.completedAt ?? null,
      createdAt: now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  static reconstitute(props: ReturnProps): Return {
    return new Return(props);
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

  get shipmentId(): string | null {
    return this.props.shipmentId;
  }

  get status(): ReturnStatusType {
    return this.props.status;
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

  get receivedAt(): Date | null {
    return this.props.receivedAt;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  approve(at: Date = new Date()): Return {
    assertReturnTransition(this.props.status, ReturnStatus.APPROVED);
    return this.withStatus(ReturnStatus.APPROVED, at);
  }

  receive(at: Date = new Date()): Return {
    if (this.props.status === ReturnStatus.RECEIVED) {
      return this;
    }
    assertReturnTransition(this.props.status, ReturnStatus.RECEIVED);
    return new Return({
      ...this.props,
      status: ReturnStatus.RECEIVED,
      updatedAt: at,
      receivedAt: at,
    });
  }

  complete(at: Date = new Date()): Return {
    assertReturnTransition(this.props.status, ReturnStatus.COMPLETED);
    return new Return({
      ...this.props,
      status: ReturnStatus.COMPLETED,
      updatedAt: at,
      completedAt: at,
    });
  }

  reject(at: Date = new Date()): Return {
    assertReturnTransition(this.props.status, ReturnStatus.REJECTED);
    return this.withStatus(ReturnStatus.REJECTED, at);
  }

  cancel(at: Date = new Date()): Return {
    assertReturnTransition(this.props.status, ReturnStatus.CANCELLED);
    return this.withStatus(ReturnStatus.CANCELLED, at);
  }

  private withStatus(status: ReturnStatusType, at: Date): Return {
    if (this.props.status === status) {
      throw new BusinessRuleError('Return is already in the requested status', {
        returnId: this.props.id,
        status,
      });
    }
    return new Return({
      ...this.props,
      status,
      updatedAt: at,
    });
  }

  toProps(): ReturnProps {
    return { ...this.props };
  }
}
