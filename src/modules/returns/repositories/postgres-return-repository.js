import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { reconstituteReturn } from '../models/return.js';
import { reconstituteReturnLine } from '../models/return-line.js';
import { PENDING_RETURN_STATUSES, ReturnStatus } from '../models/return-status.js';
const returnRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    external_reference: z.string().nullable(),
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
const returnSelect = `id, tenant_id, order_id, external_reference, shipment_id, status, reason,
  created_at, updated_at, received_at, completed_at`;
const returnSelectAliased = `r.id, r.tenant_id, r.order_id, r.external_reference, r.shipment_id, r.status, r.reason,
  r.created_at, r.updated_at, r.received_at, r.completed_at`;
const returnLineSelect = `id, tenant_id, return_id, order_line_id, quantity, reason,
  created_at, updated_at`;
/** Maps a validated SQL row into a domain return entity. */
function toReturn(row) {
    return reconstituteReturn({
        id: row.id,
        tenantId: row.tenant_id,
        orderId: row.order_id,
        externalReference: row.external_reference,
        shipmentId: row.shipment_id,
        status: row.status,
        reason: row.reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        receivedAt: row.received_at,
        completedAt: row.completed_at,
    });
}
/** Maps a validated SQL row into a domain return entity. */
function toReturnLine(row) {
    return reconstituteReturnLine({
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
/** Builds tenant-scoped SQL WHERE fragments and optional order joins for list/count queries. */
function buildListConditions(tenantId, filters) {
        const conditions = ['r.tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        let joinOrders = false;
        if (filters.orderNumbers !== undefined || filters.externalOrderReferences !== undefined) {
            joinOrders = true;
        }
        if (filters.externalReferences !== undefined) {
            if (filters.externalReferences.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`r.external_reference = ANY($${paramIndex++}::text[])`);
                params.push(filters.externalReferences);
            }
        }
        if (filters.orderId !== undefined) {
            conditions.push(`r.order_id = $${paramIndex++}`);
            params.push(filters.orderId);
        }
        if (filters.orderNumbers !== undefined) {
            if (filters.orderNumbers.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`o.order_number = ANY($${paramIndex++}::text[])`);
                params.push(filters.orderNumbers);
            }
        }
        if (filters.externalOrderReferences !== undefined) {
            if (filters.externalOrderReferences.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`o.external_order_reference = ANY($${paramIndex++}::text[])`);
                params.push(filters.externalOrderReferences);
            }
        }
        if (filters.status !== undefined) {
            conditions.push(`r.status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.statuses !== undefined) {
            if (filters.statuses.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`r.status = ANY($${paramIndex++}::text[])`);
                params.push(filters.statuses);
            }
        }
        if (filters.reasons !== undefined) {
            if (filters.reasons.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`r.reason = ANY($${paramIndex++}::text[])`);
                params.push(filters.reasons);
            }
        }
        if (filters.createdAfter !== undefined) {
            conditions.push(`r.created_at >= $${paramIndex++}`);
            params.push(filters.createdAfter);
        }
        if (filters.createdBefore !== undefined) {
            conditions.push(`r.created_at < $${paramIndex++}`);
            params.push(filters.createdBefore);
        }
        if (filters.updatedAfter !== undefined) {
            conditions.push(`r.updated_at >= $${paramIndex++}`);
            params.push(filters.updatedAfter);
        }
        if (filters.updatedBefore !== undefined) {
            conditions.push(`r.updated_at < $${paramIndex++}`);
            params.push(filters.updatedBefore);
        }
        const joinClause = joinOrders
            ? 'INNER JOIN orders o ON o.tenant_id = r.tenant_id AND o.id = r.order_id'
            : '';
        return { conditions, params, nextParamIndex: paramIndex, joinClause };
    }


/** Postgres persistence factory; every query is scoped by `tenant_id`. */
export function createPostgresReturnRepository() {
    return {
/** Loads one return by id within the tenant; returns null when missing. */
        async findById(queryable, tenantId, returnId) {
        const result = await queryable.query(`SELECT ${returnSelect} FROM returns WHERE tenant_id = $1 AND id = $2`, [tenantId, returnId], { operation: 'returns.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toReturn(parseOrThrow(returnRowSchema, row, 'returns row'));
        },
/** Resolves a return by tenant-scoped external reference for idempotent ingestion. */
        async findByExternalReference(queryable, tenantId, externalReference) {
        const result = await queryable.query(`SELECT ${returnSelect}
       FROM returns
       WHERE tenant_id = $1 AND external_reference = $2`, [tenantId, externalReference], { operation: 'returns.find_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toReturn(parseOrThrow(returnRowSchema, row, 'returns row'));
        },
/** `SELECT … FOR UPDATE` row lock on the return (and tenant) inside a transaction. */
        async lockByExternalReferenceForUpdate(transaction, tenantId, externalReference) {
        const result = await transaction.query(`SELECT ${returnSelect}
       FROM returns
       WHERE tenant_id = $1 AND external_reference = $2
       FOR UPDATE`, [tenantId, externalReference], { operation: 'returns.lock_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toReturn(parseOrThrow(returnRowSchema, row, 'returns row'));
        },
/** `SELECT … FOR UPDATE` row lock on the return (and tenant) inside a transaction. */
        async lockForUpdate(transaction, tenantId, returnId) {
        const result = await transaction.query(`SELECT ${returnSelect}
       FROM returns
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`, [tenantId, returnId], { operation: 'returns.lock_for_update' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toReturn(parseOrThrow(returnRowSchema, row, 'returns row'));
        },
/** Counts returns matching filters for offset pagination totals. */
        async count(queryable, tenantId, filters) {
        const { conditions, params, joinClause } = buildListConditions(tenantId, filters);
        const result = await queryable.query(`SELECT COUNT(*)::int AS total
       FROM returns r
       ${joinClause}
       WHERE ${conditions.join(' AND ')}`, params, { operation: 'returns.count' });
        const row = result.rows[0];
        return Number(row?.total ?? 0);
        },
/** Offset page of returns with sort direction; uses shared list filter builder. */
        async listPageOffset(queryable, tenantId, filters, page, pageSize, sortDirection = 'desc') {
        const { conditions, params, nextParamIndex, joinClause } = buildListConditions(tenantId, filters);
        const offset = (page - 1) * pageSize;
        const limitParam = nextParamIndex;
        const offsetParam = nextParamIndex + 1;
        const listParams = [...params, pageSize, offset];
        const orderDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';
        const result = await queryable.query(`SELECT ${returnSelectAliased}
       FROM returns r
       ${joinClause}
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at ${orderDirection}, r.id ${orderDirection}
       LIMIT $${limitParam} OFFSET $${offsetParam}`, listParams, { operation: 'returns.list_page_offset' });
        return result.rows.map((row) => toReturn(parseOrThrow(returnRowSchema, row, 'returns row')));
        },
/** Keyset (cursor) page of returns ordered by created time within the tenant. */
        async listPage(queryable, tenantId, filters, limit, cursorCreatedAt, cursorId) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
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
        const result = await queryable.query(`SELECT ${returnSelect}
       FROM returns
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIndex}`, params, { operation: 'returns.list_page' });
        return {
            items: result.rows.map((row) => toReturn(parseOrThrow(returnRowSchema, row, 'returns row'))),
        };
        },
/** Persists a new return row (and related lines when applicable) in the current transaction. */
        async insertReturn(transaction, returnEntity) {
        const p = returnEntity;
        await transaction.query(`INSERT INTO returns (
         id, tenant_id, order_id, external_reference, shipment_id, status, reason,
         created_at, updated_at, received_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
            p.id,
            p.tenantId,
            p.orderId,
            p.externalReference ?? null,
            p.shipmentId,
            p.status,
            p.reason,
            p.createdAt,
            p.updatedAt,
            p.receivedAt,
            p.completedAt,
        ], { operation: 'returns.insert' });
        },
/** Updates mutable return columns; `tenant_id` and id constrain the row. */
        async updateReturn(transaction, returnEntity) {
        const p = returnEntity;
        await transaction.query(`UPDATE returns SET
         status = $3, reason = $4, updated_at = $5, received_at = $6, completed_at = $7
       WHERE tenant_id = $1 AND id = $2`, [p.tenantId, p.id, p.status, p.reason, p.updatedAt, p.receivedAt, p.completedAt], { operation: 'returns.update' });
        },
/** Persists a new return row (and related lines when applicable) in the current transaction. */
        async insertReturnLine(transaction, line) {
        const p = line;
        await transaction.query(`INSERT INTO return_lines (
         id, tenant_id, return_id, order_line_id, quantity, reason, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [p.id, p.tenantId, p.returnId, p.orderLineId, p.quantity, p.reason, p.createdAt, p.updatedAt], { operation: 'return_lines.insert' });
        },
/** Lists child rows for a return within the tenant. */
        async listReturnLines(queryable, tenantId, returnId) {
        const result = await queryable.query(`SELECT ${returnLineSelect}
       FROM return_lines
       WHERE tenant_id = $1 AND return_id = $2
       ORDER BY created_at`, [tenantId, returnId], { operation: 'return_lines.list' });
        return result.rows.map((row) => toReturnLine(parseOrThrow(returnLineRowSchema, row, 'return_lines row')));
        },
/** Repository operation on return data (tenant-isolated SQL). */
        async sumPendingQuantitiesByOrderLine(transaction, tenantId, orderId, orderLineIds, excludeReturnId) {
        if (orderLineIds.length === 0) {
            return new Map();
        }
        const params = [tenantId, orderId, [...PENDING_RETURN_STATUSES]];
        let excludeClause = '';
        if (excludeReturnId !== undefined) {
            params.push(excludeReturnId);
            excludeClause = ` AND r.id <> $${params.length}`;
        }
        params.push(orderLineIds);
        const result = await transaction.query(`SELECT rl.order_line_id, COALESCE(SUM(rl.quantity), 0)::int AS pending_quantity
       FROM return_lines rl
       INNER JOIN returns r ON r.tenant_id = rl.tenant_id AND r.id = rl.return_id
       WHERE rl.tenant_id = $1
         AND r.order_id = $2
         AND r.status = ANY($3::text[])
         ${excludeClause}
         AND rl.order_line_id = ANY($${params.length}::uuid[])
       GROUP BY rl.order_line_id`, params, { operation: 'returns.sum_pending_quantities' });
        const map = new Map();
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
        },
/** Repository operation on return data (tenant-isolated SQL). */
        async verifyShipmentBelongsToOrder(queryable, tenantId, orderId, shipmentId) {
        const result = await queryable.query(`SELECT 1 FROM shipments
       WHERE tenant_id = $1 AND order_id = $2 AND id = $3`, [tenantId, orderId, shipmentId], { operation: 'returns.verify_shipment' });
        return result.rows.length > 0;
        },
    };
}
