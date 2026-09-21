import type { Permission } from '../permission.js';

export interface PermissionRepository {
  listAll(): Promise<readonly Permission[]>;
  listKeys(): Promise<readonly string[]>;
}
