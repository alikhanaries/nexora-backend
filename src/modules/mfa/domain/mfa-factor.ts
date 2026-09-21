export type MfaFactorType = 'TOTP';
export type MfaFactorStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';

export interface MfaFactor {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly factorType: MfaFactorType;
  readonly status: MfaFactorStatus;
  readonly secretEncrypted: string;
  readonly label: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly activatedAt: Date | null;
  readonly revokedAt: Date | null;
}
