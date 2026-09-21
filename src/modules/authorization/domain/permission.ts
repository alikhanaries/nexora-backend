export interface Permission {
  readonly id: string;
  readonly key: string;
  readonly description: string;
  readonly createdAt: Date;
}

export const TENANT_ADMIN_PERMISSION = 'tenant.admin' as const;
