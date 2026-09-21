import { BusinessRuleError } from '../../../shared/errors/index.js';
import { TenantStatus } from './tenant-status.js';

export interface TenantProps {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTenantProps {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: Date;
}

export class Tenant {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: TenantProps) {
    this.id = props.id;
    this.slug = props.slug;
    this.name = props.name;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: NewTenantProps): Tenant {
    return new Tenant({
      id: props.id,
      slug: props.slug,
      name: props.name,
      status: TenantStatus.ACTIVE,
      createdAt: props.createdAt,
      updatedAt: props.createdAt,
    });
  }

  static reconstitute(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  suspend(at: Date): Tenant {
    if (this.status === TenantStatus.CLOSED) {
      throw new BusinessRuleError('Cannot suspend a closed tenant');
    }
    if (this.status === TenantStatus.SUSPENDED) {
      throw new BusinessRuleError('Tenant is already suspended');
    }
    return this.withStatus(TenantStatus.SUSPENDED, at);
  }

  reactivate(at: Date): Tenant {
    if (this.status === TenantStatus.CLOSED) {
      throw new BusinessRuleError('Cannot reactivate a closed tenant');
    }
    if (this.status === TenantStatus.ACTIVE) {
      throw new BusinessRuleError('Tenant is already active');
    }
    return this.withStatus(TenantStatus.ACTIVE, at);
  }

  close(at: Date): Tenant {
    if (this.status === TenantStatus.CLOSED) {
      throw new BusinessRuleError('Tenant is already closed');
    }
    return this.withStatus(TenantStatus.CLOSED, at);
  }

  private withStatus(status: TenantStatus, updatedAt: Date): Tenant {
    return new Tenant({
      id: this.id,
      slug: this.slug,
      name: this.name,
      status,
      createdAt: this.createdAt,
      updatedAt,
    });
  }
}
