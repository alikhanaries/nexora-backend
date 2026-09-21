import { BusinessRuleError } from '../../../shared/errors/index.js';

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

const MEMBERSHIP_TRANSITIONS: Readonly<Record<MembershipStatus, readonly MembershipStatus[]>> = {
  PENDING: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['ACTIVE', 'REVOKED'],
  REVOKED: [],
};

export interface MembershipProps {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Membership {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: MembershipProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: MembershipProps): Membership {
    return new Membership(props);
  }

  static createPending(id: string, tenantId: string, userId: string): Membership {
    const now = new Date();
    return new Membership({
      id,
      tenantId,
      userId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });
  }

  grantsAccess(): boolean {
    return this.status === 'ACTIVE';
  }

  isTerminal(): boolean {
    return this.status === 'REVOKED';
  }

  activate(): Membership {
    return this.transitionTo('ACTIVE');
  }

  suspend(): Membership {
    return this.transitionTo('SUSPENDED');
  }

  revoke(): Membership {
    return this.transitionTo('REVOKED');
  }

  transitionTo(nextStatus: MembershipStatus): Membership {
    if (this.status === nextStatus) return this;

    const allowed = MEMBERSHIP_TRANSITIONS[this.status];
    if (!allowed.includes(nextStatus)) {
      throw new BusinessRuleError(
        `Membership status cannot transition from ${this.status} to ${nextStatus}`,
      );
    }

    return new Membership({
      ...this,
      status: nextStatus,
      updatedAt: new Date(),
    });
  }
}

export function canTransitionMembershipStatus(
  from: MembershipStatus,
  to: MembershipStatus,
): boolean {
  if (from === to) return true;
  return MEMBERSHIP_TRANSITIONS[from].includes(to);
}
