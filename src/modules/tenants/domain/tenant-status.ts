export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CLOSED: 'CLOSED',
} as const;

export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const TENANT_STATUSES: readonly TenantStatus[] = [
  TenantStatus.ACTIVE,
  TenantStatus.SUSPENDED,
  TenantStatus.CLOSED,
];
