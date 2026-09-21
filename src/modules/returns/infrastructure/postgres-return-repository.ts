import { z } from 'zod';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { Return } from '../domain/return.js';
import { ReturnLine } from '../domain/return-line.js';
import { PENDING_RETURN_STATUSES, ReturnStatus } from '../domain/return-status.js';
import type { ReturnListFilters, ReturnRepository } from '../domain/return-repository.port.js';

const returnRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  shipment_id: z.string().uuid().nullable(),
  status: z.enum([
    ReturnStatus.REQUESTED,
    ReturnStatus.APPROVED,
    ReturnStatus.RECEIVED,
    ReturnStatus.COMPLETED,
    ReturnStatus.REJECTED,
    ReturnStatus.CANCELLED,
  ]),
  reason: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  received_at: z.date().nullable(),
  completed_at: z.date().nullable(),
});

const returnLineRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  return_id: z.string().uuid(),
  order_line_id: z.string().uuid(),
  quantity: z.coerce.number(),
  reason: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

const returnSelect = `id, tenant_id, order_id, shipment_id, status, reason,
  created_at, updated_at, received_at, completed_at`;

const returnLineSelect = `id, tenant_id, return_id, order_line_id, quantity, reason,
  created_at, updated_at`;

function toReturn(row: z.infer<typeof returnRowSchema>): Return {
  return Return.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    shipmentId: row.shipment_id,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receivedAt: row.received_at,
    completedAt: row.completed_at,
  });
}

function toReturnLine(row: z.infer<typeof returnLineRowSchema>): ReturnLine {
  return ReturnLine.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    returnId: row.return_id,
    orderLineId: row.order_line_id,
    quantity: row.quantity,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class PostgresReturnRepository implements ReturnRepository {
  async findById(queryable: Queryable, tenantId: string, returnId: string): Promise<Return | null> {
    const result = await queryable.query(
      `SELECT ${returnSelect} FROM returns WHERE tenant_id = $1 AND id = $2`,
      [tenantId, returnId],
      { operation: 'returns.find_by_id' },
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return toReturn(parseOrThrow(returnRowSchema, row, 'returns row'));
  }

  async lockForUpdate(
    transaction: Transaction,
    tenantId: string,
    returnId: string,
  ): Promise<Return | null> {
    const result = await transaction.query(
      `SELECT ${returnSelect}
       FROM returns
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [tenantId, returnId],
      { operation: 'returns.lock_for_update' },
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return toReturn(parseOrThrow(returnRowSchema, row, 'returns row'));
  }

  async listPage(
    queryable: Queryable,
    tenantId: string,
    filters: ReturnListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Return[] }> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters.orderId !== undefined) {
      conditions.push(`order_id = $${paramIndex++}`);
      params.push(filters.orderId);
    }

    if (filters.status !== undefined) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (cursorCreatedAt !== null && cursorId !== null) {
      conditions.push(`(created_at, id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`);
      params.push(cursorCreatedAt, cursorId);
    }

    params.push(limit);
    const result = await queryable.query(
      `SELECT ${returnSelect}
       FROM returns
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIndex}`,
      params,
      { operation: 'returns.list_page' },
    );

    return {
      items: result.rows.map((row) => toReturn(parseOrThrow(returnRowSchema, row, 'returns row'))),
    };
  }

  async insertReturn(transaction: Transaction, returnEntity: Return): Promise<void> {
    const p = returnEntity.toProps();
    await transaction.query(
      `INSERT INTO returns (
         id, tenant_id, order_id, shipment_id, status, reason,
         created_at, updated_at, received_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        p.id,
        p.tenantId,
        p.orderId,
        p.shipmentId,
        p.status,
        p.reason,
        p.createdAt,
        p.updatedAt,
        p.receivedAt,
        p.completedAt,
      ],
      { operation: 'returns.insert' },
    );
  }

  async updateReturn(transaction: Transaction, returnEntity: Return): Promise<void> {
    const p = returnEntity.toProps();
    await transaction.query(
      `UPDATE returns SET
         status = $3, reason = $4, updated_at = $5, received_at = $6, completed_at = $7
       WHERE tenant_id = $1 AND id = $2`,
      [p.tenantId, p.id, p.status, p.reason, p.updatedAt, p.receivedAt, p.completedAt],
      { operation: 'returns.update' },
    );
  }

  async insertReturnLine(transaction: Transaction, line: ReturnLine): Promise<void> {
    const p = line.toProps();
    await transaction.query(
      `INSERT INTO return_lines (
         id, tenant_id, return_id, order_line_id, quantity, reason, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.id, p.tenantId, p.returnId, p.orderLineId, p.quantity, p.reason, p.createdAt, p.updatedAt],
      { operation: 'return_lines.insert' },
    );
  }

  async listReturnLines(
    queryable: Queryable,
    tenantId: string,
    returnId: string,
  ): Promise<readonly ReturnLine[]> {
    const result = await queryable.query(
      `SELECT ${returnLineSelect}
       FROM return_lines
       WHERE tenant_id = $1 AND return_id = $2
       ORDER BY created_at`,
      [tenantId, returnId],
      { operation: 'return_lines.list' },
    );

    return result.rows.map((row) =>
      toReturnLine(parseOrThrow(returnLineRowSchema, row, 'return_lines row')),
    );
  }

  async sumPendingQuantitiesByOrderLine(
    transaction: Transaction,
    tenantId: string,
    orderId: string,
    orderLineIds: readonly string[],
    excludeReturnId?: string,
  ): Promise<ReadonlyMap<string, number>> {
    if (orderLineIds.length === 0) {
      return new Map();
    }

    const params: unknown[] = [tenantId, orderId, [...PENDING_RETURN_STATUSES]];
    let excludeClause = '';
    if (excludeReturnId !== undefined) {
      params.push(excludeReturnId);
      excludeClause = ` AND r.id <> $${params.length}`;
    }

    params.push(orderLineIds);
    const result = await transaction.query(
      `SELECT rl.order_line_id, COALESCE(SUM(rl.quantity), 0)::int AS pending_quantity
       FROM return_lines rl
       INNER JOIN returns r ON r.tenant_id = rl.tenant_id AND r.id = rl.return_id
       WHERE rl.tenant_id = $1
         AND r.order_id = $2
         AND r.status = ANY($3::text[])
         ${excludeClause}
         AND rl.order_line_id = ANY($${params.length}::uuid[])
       GROUP BY rl.order_line_id`,
      params,
      { operation: 'returns.sum_pending_quantities' },
    );

    const map = new Map<string, number>();
    for (const row of result.rows) {
      const parsed = z
        .object({
          order_line_id: z.string().uuid(),
          pending_quantity: z.coerce.number(),
        })
        .parse(row);
      map.set(parsed.order_line_id, parsed.pending_quantity);
    }
    return map;
  }

  async verifyShipmentBelongsToOrder(
    queryable: Queryable,
    tenantId: string,
    orderId: string,
    shipmentId: string,
  ): Promise<boolean> {
    const result = await queryable.query(
      `SELECT 1 FROM shipments
       WHERE tenant_id = $1 AND order_id = $2 AND id = $3`,
      [tenantId, orderId, shipmentId],
      { operation: 'returns.verify_shipment' },
    );
    return result.rows.length > 0;
  }
}
