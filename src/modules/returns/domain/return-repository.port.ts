import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { ReturnLine } from './return-line.js';
import type { Return } from './return.js';
import type { ReturnStatus } from './return-status.js';

export interface ReturnListFilters {
  readonly orderId?: string;
  readonly status?: ReturnStatus;
}

export interface ReturnRepository {
  findById(queryable: Queryable, tenantId: string, returnId: string): Promise<Return | null>;

  lockForUpdate(
    transaction: Transaction,
    tenantId: string,
    returnId: string,
  ): Promise<Return | null>;

  listPage(
    queryable: Queryable,
    tenantId: string,
    filters: ReturnListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Return[] }>;

  insertReturn(transaction: Transaction, returnEntity: Return): Promise<void>;
  updateReturn(transaction: Transaction, returnEntity: Return): Promise<void>;

  insertReturnLine(transaction: Transaction, line: ReturnLine): Promise<void>;

  listReturnLines(
    queryable: Queryable,
    tenantId: string,
    returnId: string,
  ): Promise<readonly ReturnLine[]>;

  sumPendingQuantitiesByOrderLine(
    transaction: Transaction,
    tenantId: string,
    orderId: string,
    orderLineIds: readonly string[],
    excludeReturnId?: string,
  ): Promise<ReadonlyMap<string, number>>;

  verifyShipmentBelongsToOrder(
    queryable: Queryable,
    tenantId: string,
    orderId: string,
    shipmentId: string,
  ): Promise<boolean>;
}
