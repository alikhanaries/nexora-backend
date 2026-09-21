import { BusinessRuleError } from '../../../shared/errors/index.js';
import type { Email } from './email.js';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

const USER_TRANSITIONS: Readonly<Record<UserStatus, readonly UserStatus[]>> = {
  ACTIVE: ['LOCKED', 'DISABLED'],
  LOCKED: ['ACTIVE', 'DISABLED'],
  DISABLED: [],
};

export interface UserProps {
  readonly id: string;
  readonly email: Email;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: Email;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: UserProps): User {
    return new User(props);
  }

  static createNew(id: string, email: Email): User {
    const now = new Date();
    return new User({
      id,
      email,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  canAuthenticate(): boolean {
    return this.status === 'ACTIVE';
  }

  transitionTo(nextStatus: UserStatus): User {
    if (this.status === nextStatus) return this;

    const allowed = USER_TRANSITIONS[this.status];
    if (!allowed.includes(nextStatus)) {
      throw new BusinessRuleError(
        `User status cannot transition from ${this.status} to ${nextStatus}`,
      );
    }

    return new User({
      ...this,
      status: nextStatus,
      updatedAt: new Date(),
    });
  }
}

export function canTransitionUserStatus(from: UserStatus, to: UserStatus): boolean {
  if (from === to) return true;
  return USER_TRANSITIONS[from].includes(to);
}
