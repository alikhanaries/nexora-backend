import type { Queryable, Transaction } from '../../../../shared/persistence/index.js';
import type { StockLocation } from '../../domain/stock-location.js';

export interface StockLocationRepository {
  findById(queryable: Queryable, tenantId: string, id: string): Promise<StockLocation | null>;
  list(queryable: Queryable, tenantId: string): Promise<readonly StockLocation[]>;
  insert(transaction: Transaction, location: StockLocation): Promise<void>;
}
