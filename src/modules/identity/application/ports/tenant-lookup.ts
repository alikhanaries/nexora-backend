import type { Transaction } from '../../../../shared/persistence/index.js';

export interface TenantRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}

export interface TenantLookup {
  findBySlug(tx: Transaction, slug: string): Promise<TenantRecord | null>;
}
