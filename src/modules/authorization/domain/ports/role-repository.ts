import type { Transaction } from '../../../../shared/persistence/index.js';
import type { Permission } from '../permission.js';
import type { Role, RoleWithPermissions, SystemRoleKey } from '../role.js';

export interface CreateRoleRecord {
  readonly tenantId: string;
  readonly name: string;
  readonly permissionKeys: readonly string[];
  readonly isSystem: boolean;
  readonly systemKey: SystemRoleKey | null;
}

export interface RoleRepository {
  create(record: CreateRoleRecord, tx: Transaction): Promise<RoleWithPermissions>;
  findById(roleId: string, tx: Transaction): Promise<Role | null>;
  findByTenantAndName(tenantId: string, name: string, tx: Transaction): Promise<Role | null>;
  findSystemRoleByKey(
    tenantId: string,
    systemKey: SystemRoleKey,
    tx: Transaction,
  ): Promise<Role | null>;
  listByTenant(tenantId: string, tx: Transaction): Promise<readonly Role[]>;
  listPermissionsForRole(roleId: string, tx: Transaction): Promise<readonly Permission[]>;
  roleGrantsPermission(roleId: string, permissionKey: string, tx: Transaction): Promise<boolean>;
  setRolePermissions(
    roleId: string,
    permissionKeys: readonly string[],
    tx: Transaction,
  ): Promise<void>;
}
