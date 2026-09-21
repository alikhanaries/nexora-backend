export type RoleStatus = 'ACTIVE' | 'INACTIVE';

export type SystemRoleKey =
  | 'owner'
  | 'administrator'
  | 'operations_manager'
  | 'fulfillment_operator'
  | 'viewer'
  | 'auditor'
  | 'integration';

export interface Role {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly systemKey: SystemRoleKey | null;
  readonly status: RoleStatus;
  readonly isSystem: boolean;
  readonly clonedFromRoleId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RoleWithPermissions extends Role {
  readonly permissionKeys: readonly string[];
}
