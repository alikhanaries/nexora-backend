import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { CancellationLine } from './cancellation-line.js';
import type { Cancellation } from './cancellation.js';
import type { CancellationStatus } from './cancellation-status.js';

export interface CancellationListFilters {
  readonly orderId?: string;
  readonly status?: CancellationStatus;
}

export interface CancellationRepository {
  findById(
    queryable: Queryable,
    tenantId: string,
    cancellationId: string,
  ): Promise<Cancellation | null>;
  listLines(
    queryable: Queryable,
    tenantId: string,
    cancellationId: string,
  ): Promise<readonly CancellationLine[]>;
  listPage(
    queryable: Queryable,
    tenantId: string,
    filters: CancellationListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Cancellation[] }>;
  insertCancellation(transaction: Transaction, cancellation: Cancellation): Promise<void>;
  updateCancellation(transaction: Transaction, cancellation: Cancellation): Promise<void>;
  insertCancellationLine(transaction: Transaction, line: CancellationLine): Promise<void>;
}
