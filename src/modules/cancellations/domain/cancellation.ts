import { BusinessRuleError } from '../../../shared/errors/index.js';
import {
  CancellationStatus,
  type CancellationStatus as CancellationStatusType,
} from './cancellation-status.js';

export interface CancellationProps {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly status: CancellationStatusType;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export class Cancellation {
  private constructor(private readonly props: CancellationProps) {}

  static create(
    props: Omit<CancellationProps, 'status' | 'completedAt' | 'createdAt' | 'updatedAt'> & {
      status?: CancellationStatusType;
      completedAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Cancellation {
    const now = props.createdAt ?? new Date();
    return new Cancellation({
      ...props,
      status: props.status ?? CancellationStatus.REQUESTED,
      completedAt: props.completedAt ?? null,
      createdAt: now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  static reconstitute(props: CancellationProps): Cancellation {
    return new Cancellation(props);
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

  get status(): CancellationStatusType {
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

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  complete(at: Date = new Date()): Cancellation {
    if (this.props.status !== CancellationStatus.REQUESTED) {
      throw new BusinessRuleError('Only requested cancellations can be completed', {
        cancellationId: this.props.id,
        status: this.props.status,
      });
    }

    return new Cancellation({
      ...this.props,
      status: CancellationStatus.COMPLETED,
      completedAt: at,
      updatedAt: at,
    });
  }

  reject(at: Date = new Date()): Cancellation {
    if (this.props.status !== CancellationStatus.REQUESTED) {
      throw new BusinessRuleError('Only requested cancellations can be rejected', {
        cancellationId: this.props.id,
        status: this.props.status,
      });
    }

    return new Cancellation({
      ...this.props,
      status: CancellationStatus.REJECTED,
      updatedAt: at,
    });
  }

  toProps(): CancellationProps {
    return { ...this.props };
  }
}
