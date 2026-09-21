export type RefreshSessionStatus = 'ACTIVE' | 'REVOKED' | 'REPLACED';

export interface RefreshSessionProps {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly status: RefreshSessionStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly replacedBy: string | null;
}

export class RefreshSession {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly status: RefreshSessionStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly replacedBy: string | null;

  private constructor(props: RefreshSessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.tokenHash = props.tokenHash;
    this.familyId = props.familyId;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
    this.lastUsedAt = props.lastUsedAt;
    this.revokedAt = props.revokedAt;
    this.replacedBy = props.replacedBy;
  }

  static create(props: RefreshSessionProps): RefreshSession {
    return new RefreshSession(props);
  }

  isExpired(now: Date = new Date()): boolean {
    return now >= this.expiresAt;
  }

  isUsable(now: Date = new Date()): boolean {
    return this.status === 'ACTIVE' && !this.isExpired(now);
  }

  indicatesFamilyReuse(): boolean {
    return this.status === 'REPLACED' || this.status === 'REVOKED';
  }
}
