import type { Membership } from '../../domain/index.js';
import type { Transaction } from '../../../../shared/persistence/index.js';

export interface MembershipRepository {
  findById(tx: Transaction, id: string): Promise<Membership | null>;
  findByTenantAndUser(
    tx: Transaction,
    tenantId: string,
    userId: string,
  ): Promise<Membership | null>;
  save(tx: Transaction, membership: Membership): Promise<void>;
}
