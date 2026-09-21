import { z } from 'zod';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { CancellationLine } from '../domain/cancellation-line.js';
import { Cancellation } from '../domain/cancellation.js';
import { CancellationStatus } from '../domain/cancellation-status.js';
import type {
  CancellationListFilters,
  CancellationRepository,
} from '../domain/cancellation-repository.port.js';

const cancellationRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: z.enum([
    CancellationStatus.REQUESTED,
    CancellationStatus.COMPLETED,
    CancellationStatus.REJECTED,
  ]),
  reason: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  completed_at: z.date().nullable(),
});

const cancellationLineRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  cancellation_id: z.string().uuid(),
  order_line_id: z.string().uuid(),
  quantity: z.coerce.number(),
  created_at: z.date(),
});

const cancellationSelect = `id, tenant_id, order_id, status, reason, created_at, updated_at, completed_at`;

const cancellationLineSelect = `id, tenant_id, cancellation_id, order_line_id, quantity, created_at`;

function toCancellation(row: z.infer<typeof cancellationRowSchema>): Cancellation {
  return Cancellation.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}

function toCancellationLine(row: z.infer<typeof cancellationLineRowSchema>): CancellationLine {
  return CancellationLine.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    cancellationId: row.cancellation_id,
    orderLineId: row.order_line_id,
    quantity: row.quantity,
    createdAt: row.created_at,
  });
}

export class PostgresCancellationRepository implements CancellationRepository {
  async findById(
    queryable: Queryable,
    tenantId: string,
    cancellationId: string,
  ): Promise<Cancellation | null> {
    const result = await queryable.query(
      `SELECT ${cancellationSelect}
       FROM cancellations
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, cancellationId],
      { operation: 'cancellations.find_by_id' },
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row'));
  }

  async listLines(
    queryable: Queryable,
    tenantId: string,
    cancellationId: string,
  ): Promise<readonly CancellationLine[]> {
    const result = await queryable.query(
      `SELECT ${cancellationLineSelect}
       FROM cancellation_lines
       WHERE tenant_id = $1 AND cancellation_id = $2
       ORDER BY created_at`,
      [tenantId, cancellationId],
      { operation: 'cancellation_lines.list' },
    );

    return result.rows.map((row) =>
      toCancellationLine(parseOrThrow(cancellationLineRowSchema, row, 'cancellation_lines row')),
    );
  }

  async listPage(
    queryable: Queryable,
    tenantId: string,
    filters: CancellationListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Cancellation[] }> {
    const conditions = ['tenant_id = $1'];
    const parameters: unknown[] = [tenantId];

    if (filters.orderId !== undefined) {
      parameters.push(filters.orderId);
      conditions.push(`order_id = $${parameters.length}`);
    }

    if (filters.status !== undefined) {
      parameters.push(filters.status);
      conditions.push(`status = $${parameters.length}`);
    }

    if (cursorCreatedAt !== null && cursorId !== null) {
      parameters.push(cursorCreatedAt, cursorId);
      conditions.push(`(created_at, id) < ($${parameters.length - 1}, $${parameters.length})`);
    }

    parameters.push(limit);

    const result = await queryable.query(
      `SELECT ${cancellationSelect}
       FROM cancellations
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${parameters.length}`,
      parameters,
      { operation: 'cancellations.list_page' },
    );

    return {
      items: result.rows.map((row) =>
        toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row')),
      ),
    };
  }

  async insertCancellation(transaction: Transaction, cancellation: Cancellation): Promise<void> {
    const props = cancellation.toProps();
    await transaction.query(
      `INSERT INTO cancellations (
         id, tenant_id, order_id, status, reason, created_at, updated_at, completed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        props.id,
        props.tenantId,
        props.orderId,
        props.status,
        props.reason,
        props.createdAt,
        props.updatedAt,
        props.completedAt,
      ],
      { operation: 'cancellations.insert' },
    );
  }

  async updateCancellation(transaction: Transaction, cancellation: Cancellation): Promise<void> {
    const props = cancellation.toProps();
    await transaction.query(
      `UPDATE cancellations
       SET status = $3, reason = $4, updated_at = $5, completed_at = $6
       WHERE tenant_id = $1 AND id = $2`,
      [props.tenantId, props.id, props.status, props.reason, props.updatedAt, props.completedAt],
      { operation: 'cancellations.update' },
    );
  }

  async insertCancellationLine(transaction: Transaction, line: CancellationLine): Promise<void> {
    const props = line.toProps();
    await transaction.query(
      `INSERT INTO cancellation_lines (
         id, tenant_id, cancellation_id, order_line_id, quantity, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        props.id,
        props.tenantId,
        props.cancellationId,
        props.orderLineId,
        props.quantity,
        props.createdAt,
      ],
      { operation: 'cancellation_lines.insert' },
    );
  }
}
