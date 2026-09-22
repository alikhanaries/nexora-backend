import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { CancellationLine } from '../domain/cancellation-line.js';
import { Cancellation } from '../domain/cancellation.js';
import { CancellationStatus } from '../domain/cancellation-status.js';
const cancellationRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    external_reference: z.string().nullable(),
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
const cancellationSelect = `id, tenant_id, order_id, external_reference, status, reason, created_at, updated_at, completed_at`;
const cancellationSelectAliased = `c.id, c.tenant_id, c.order_id, c.external_reference, c.status, c.reason, c.created_at, c.updated_at, c.completed_at`;
const cancellationLineSelect = `id, tenant_id, cancellation_id, order_line_id, quantity, created_at`;
function toCancellation(row) {
    return Cancellation.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        orderId: row.order_id,
        externalReference: row.external_reference,
        status: row.status,
        reason: row.reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
    });
}
function toCancellationLine(row) {
    return CancellationLine.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        cancellationId: row.cancellation_id,
        orderLineId: row.order_line_id,
        quantity: row.quantity,
        createdAt: row.created_at,
    });
}
export class PostgresCancellationRepository {
    async findById(queryable, tenantId, cancellationId) {
        const result = await queryable.query(`SELECT ${cancellationSelect}
       FROM cancellations
       WHERE tenant_id = $1 AND id = $2`, [tenantId, cancellationId], { operation: 'cancellations.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row'));
    }
    async findByExternalReference(queryable, tenantId, externalReference) {
        const result = await queryable.query(`SELECT ${cancellationSelect}
       FROM cancellations
       WHERE tenant_id = $1 AND external_reference = $2`, [tenantId, externalReference], { operation: 'cancellations.find_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row'));
    }
    async lockByExternalReferenceForUpdate(transaction, tenantId, externalReference) {
        const result = await transaction.query(`SELECT ${cancellationSelect}
       FROM cancellations
       WHERE tenant_id = $1 AND external_reference = $2
       FOR UPDATE`, [tenantId, externalReference], { operation: 'cancellations.lock_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row'));
    }
    async listLines(queryable, tenantId, cancellationId) {
        const result = await queryable.query(`SELECT ${cancellationLineSelect}
       FROM cancellation_lines
       WHERE tenant_id = $1 AND cancellation_id = $2
       ORDER BY created_at`, [tenantId, cancellationId], { operation: 'cancellation_lines.list' });
        return result.rows.map((row) => toCancellationLine(parseOrThrow(cancellationLineRowSchema, row, 'cancellation_lines row')));
    }
    buildListConditions(tenantId, filters) {
        const conditions = ['c.tenant_id = $1'];
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
                conditions.push(`c.external_reference = ANY($${paramIndex++}::text[])`);
                params.push(filters.externalReferences);
            }
        }
        if (filters.orderId !== undefined) {
            conditions.push(`c.order_id = $${paramIndex++}`);
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
            conditions.push(`c.status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.statuses !== undefined) {
            if (filters.statuses.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`c.status = ANY($${paramIndex++}::text[])`);
                params.push(filters.statuses);
            }
        }
        if (filters.createdAfter !== undefined) {
            conditions.push(`c.created_at >= $${paramIndex++}`);
            params.push(filters.createdAfter);
        }
        if (filters.createdBefore !== undefined) {
            conditions.push(`c.created_at < $${paramIndex++}`);
            params.push(filters.createdBefore);
        }
        if (filters.updatedAfter !== undefined) {
            conditions.push(`c.updated_at >= $${paramIndex++}`);
            params.push(filters.updatedAfter);
        }
        if (filters.updatedBefore !== undefined) {
            conditions.push(`c.updated_at < $${paramIndex++}`);
            params.push(filters.updatedBefore);
        }
        const joinClause = joinOrders
            ? 'INNER JOIN orders o ON o.tenant_id = c.tenant_id AND o.id = c.order_id'
            : '';
        return { conditions, params, nextParamIndex: paramIndex, joinClause };
    }
    async count(queryable, tenantId, filters) {
        const { conditions, params, joinClause } = this.buildListConditions(tenantId, filters);
        const result = await queryable.query(`SELECT COUNT(*)::int AS total
       FROM cancellations c
       ${joinClause}
       WHERE ${conditions.join(' AND ')}`, params, { operation: 'cancellations.count' });
        const row = result.rows[0];
        return Number(row?.total ?? 0);
    }
    async listPageOffset(queryable, tenantId, filters, page, pageSize, sortDirection = 'asc') {
        const { conditions, params, nextParamIndex, joinClause } = this.buildListConditions(tenantId, filters);
        const offset = (page - 1) * pageSize;
        const limitParam = nextParamIndex;
        const offsetParam = nextParamIndex + 1;
        const listParams = [...params, pageSize, offset];
        const orderDirection = sortDirection === 'desc' ? 'DESC' : 'ASC';
        const result = await queryable.query(`SELECT ${cancellationSelectAliased}
       FROM cancellations c
       ${joinClause}
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at ${orderDirection}, c.id ${orderDirection}
       LIMIT $${limitParam} OFFSET $${offsetParam}`, listParams, { operation: 'cancellations.list_page_offset' });
        return result.rows.map((row) => toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row')));
    }
    async listPage(queryable, tenantId, filters, limit, cursorCreatedAt, cursorId) {
        const conditions = ['tenant_id = $1'];
        const parameters = [tenantId];
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
        const result = await queryable.query(`SELECT ${cancellationSelect}
       FROM cancellations
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${parameters.length}`, parameters, { operation: 'cancellations.list_page' });
        return {
            items: result.rows.map((row) => toCancellation(parseOrThrow(cancellationRowSchema, row, 'cancellations row'))),
        };
    }
    async insertCancellation(transaction, cancellation) {
        const props = cancellation.toProps();
        await transaction.query(`INSERT INTO cancellations (
         id, tenant_id, order_id, external_reference, status, reason, created_at, updated_at, completed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            props.id,
            props.tenantId,
            props.orderId,
            props.externalReference ?? null,
            props.status,
            props.reason,
            props.createdAt,
            props.updatedAt,
            props.completedAt,
        ], { operation: 'cancellations.insert' });
    }
    async updateCancellation(transaction, cancellation) {
        const props = cancellation.toProps();
        await transaction.query(`UPDATE cancellations
       SET status = $3, reason = $4, updated_at = $5, completed_at = $6
       WHERE tenant_id = $1 AND id = $2`, [props.tenantId, props.id, props.status, props.reason, props.updatedAt, props.completedAt], { operation: 'cancellations.update' });
    }
    async insertCancellationLine(transaction, line) {
        const props = line.toProps();
        await transaction.query(`INSERT INTO cancellation_lines (
         id, tenant_id, cancellation_id, order_line_id, quantity, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`, [
            props.id,
            props.tenantId,
            props.cancellationId,
            props.orderLineId,
            props.quantity,
            props.createdAt,
        ], { operation: 'cancellation_lines.insert' });
    }
}
