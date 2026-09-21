import type { Transaction } from '../persistence/index.js';

export interface MembershipPermissionResolver {
  resolvePermissions(
    tx: Transaction,
    input: { readonly userId: string; readonly tenantId: string },
  ): Promise<readonly string[]>;
}
