import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { Tenant } from './tenant.js';

export interface TenantRepository {
  findById(queryable: Queryable, id: string): Promise<Tenant | null>;
  findBySlug(queryable: Queryable, slug: string): Promise<Tenant | null>;
  insert(transaction: Transaction, tenant: Tenant): Promise<void>;
  update(transaction: Transaction, tenant: Tenant): Promise<void>;
}
