import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { ShipmentLine } from '../domain/shipment-line.js';
import { Shipment } from '../domain/shipment.js';
import { ShipmentStatus } from '../domain/shipment-status.js';
const shipmentRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    external_reference: z.string().nullable(),
    carrier: z.string().nullable(),
    service: z.string().nullable(),
    tracking_number: z.string().nullable(),
    status: z.enum([
        ShipmentStatus.CREATED,
        ShipmentStatus.READY_TO_SHIP,
        ShipmentStatus.SHIPPED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.FAILED,
        ShipmentStatus.CANCELLED,
    ]),
    shipped_at: z.date().nullable(),
    delivered_at: z.date().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
});
const shipmentLineRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    shipment_id: z.string().uuid(),
    order_line_id: z.string().uuid(),
    quantity: z.coerce.number(),
    created_at: z.date(),
});
const shipmentSelect = `id, tenant_id, order_id, external_reference, carrier, service, tracking_number, status,
  shipped_at, delivered_at, created_at, updated_at`;
const shipmentSelectAliased = `s.id, s.tenant_id, s.order_id, s.external_reference, s.carrier, s.service, s.tracking_number, s.status,
  s.shipped_at, s.delivered_at, s.created_at, s.updated_at`;
const shipmentLineSelect = `id, tenant_id, shipment_id, order_line_id, quantity, created_at`;
function toShipment(row) {
    return Shipment.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        orderId: row.order_id,
        externalReference: row.external_reference,
        carrier: row.carrier,
        service: row.service,
        trackingNumber: row.tracking_number,
        status: row.status,
        shippedAt: row.shipped_at,
        deliveredAt: row.delivered_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
function toShipmentLine(row) {
    return ShipmentLine.reconstitute({
        id: row.id,
        tenantId: row.tenant_id,
        shipmentId: row.shipment_id,
        orderLineId: row.order_line_id,
        quantity: row.quantity,
        createdAt: row.created_at,
    });
}
export class PostgresShipmentRepository {
    async findById(queryable, tenantId, shipmentId) {
        const result = await queryable.query(`SELECT ${shipmentSelect} FROM shipments WHERE tenant_id = $1 AND id = $2`, [tenantId, shipmentId], { operation: 'shipments.find_by_id' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'));
    }
    async findByExternalReference(queryable, tenantId, externalReference) {
        const result = await queryable.query(`SELECT ${shipmentSelect}
       FROM shipments
       WHERE tenant_id = $1 AND external_reference = $2`, [tenantId, externalReference], { operation: 'shipments.find_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'));
    }
    async lockByExternalReferenceForUpdate(transaction, tenantId, externalReference) {
        const result = await transaction.query(`SELECT ${shipmentSelect}
       FROM shipments
       WHERE tenant_id = $1 AND external_reference = $2
       FOR UPDATE`, [tenantId, externalReference], { operation: 'shipments.lock_by_external_reference' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'));
    }
    buildListConditions(tenantId, filters) {
        const conditions = ['s.tenant_id = $1'];
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
                conditions.push(`s.external_reference = ANY($${paramIndex++}::text[])`);
                params.push(filters.externalReferences);
            }
        }
        if (filters.orderIds !== undefined) {
            if (filters.orderIds.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`s.order_id = ANY($${paramIndex++}::uuid[])`);
                params.push(filters.orderIds);
            }
        }
        if (filters.orderId !== undefined) {
            conditions.push(`s.order_id = $${paramIndex++}`);
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
            conditions.push(`s.status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.statuses !== undefined) {
            if (filters.statuses.length === 0) {
                conditions.push('FALSE');
            }
            else {
                conditions.push(`s.status = ANY($${paramIndex++}::text[])`);
                params.push(filters.statuses);
            }
        }
        if (filters.trackingNumber !== undefined) {
            conditions.push(`s.tracking_number = $${paramIndex++}`);
            params.push(filters.trackingNumber);
        }
        if (filters.carrier !== undefined) {
            conditions.push(`s.carrier = $${paramIndex++}`);
            params.push(filters.carrier);
        }
        if (filters.shippedAfter !== undefined) {
            conditions.push(`s.shipped_at >= $${paramIndex++}`);
            params.push(filters.shippedAfter);
        }
        if (filters.shippedBefore !== undefined) {
            conditions.push(`s.shipped_at < $${paramIndex++}`);
            params.push(filters.shippedBefore);
        }
        if (filters.createdAfter !== undefined) {
            conditions.push(`s.created_at >= $${paramIndex++}`);
            params.push(filters.createdAfter);
        }
        if (filters.createdBefore !== undefined) {
            conditions.push(`s.created_at < $${paramIndex++}`);
            params.push(filters.createdBefore);
        }
        if (filters.updatedAfter !== undefined) {
            conditions.push(`s.updated_at >= $${paramIndex++}`);
            params.push(filters.updatedAfter);
        }
        if (filters.updatedBefore !== undefined) {
            conditions.push(`s.updated_at < $${paramIndex++}`);
            params.push(filters.updatedBefore);
        }
        if (filters.deliveredAfter !== undefined) {
            conditions.push(`s.delivered_at >= $${paramIndex++}`);
            params.push(filters.deliveredAfter);
        }
        if (filters.deliveredBefore !== undefined) {
            conditions.push(`s.delivered_at < $${paramIndex++}`);
            params.push(filters.deliveredBefore);
        }
        const joinClause = joinOrders
            ? 'INNER JOIN orders o ON o.tenant_id = s.tenant_id AND o.id = s.order_id'
            : '';
        return { conditions, params, nextParamIndex: paramIndex, joinClause };
    }
    async count(queryable, tenantId, filters) {
        const { conditions, params, joinClause } = this.buildListConditions(tenantId, filters);
        const result = await queryable.query(`SELECT COUNT(*)::int AS total
       FROM shipments s
       ${joinClause}
       WHERE ${conditions.join(' AND ')}`, params, { operation: 'shipments.count' });
        const row = result.rows[0];
        return Number(row?.total ?? 0);
    }
    async listPageOffset(queryable, tenantId, filters, page, pageSize, sortDirection = 'desc') {
        const { conditions, params, nextParamIndex, joinClause } = this.buildListConditions(tenantId, filters);
        const offset = (page - 1) * pageSize;
        const limitParam = nextParamIndex;
        const offsetParam = nextParamIndex + 1;
        const listParams = [...params, pageSize, offset];
        const orderDirection = sortDirection === 'asc' ? 'ASC' : 'DESC';
        const result = await queryable.query(`SELECT ${shipmentSelectAliased}
       FROM shipments s
       ${joinClause}
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at ${orderDirection}, s.id ${orderDirection}
       LIMIT $${limitParam} OFFSET $${offsetParam}`, listParams, { operation: 'shipments.list_page_offset' });
        return result.rows.map((row) => toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row')));
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
        if (filters.trackingNumber !== undefined) {
            parameters.push(filters.trackingNumber);
            conditions.push(`tracking_number = $${parameters.length}`);
        }
        if (cursorCreatedAt !== null && cursorId !== null) {
            parameters.push(cursorCreatedAt, cursorId);
            conditions.push(`(created_at, id) < ($${parameters.length - 1}, $${parameters.length})`);
        }
        parameters.push(limit);
        const result = await queryable.query(`SELECT ${shipmentSelect}
       FROM shipments
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${parameters.length}`, parameters, { operation: 'shipments.list_page' });
        return {
            items: result.rows.map((row) => toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'))),
        };
    }
    async insertShipment(transaction, shipment) {
        const p = shipment.toProps();
        await transaction.query(`INSERT INTO shipments (
         id, tenant_id, order_id, external_reference, carrier, service, tracking_number, status,
         shipped_at, delivered_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
            p.id,
            p.tenantId,
            p.orderId,
            p.externalReference,
            p.carrier,
            p.service,
            p.trackingNumber,
            p.status,
            p.shippedAt,
            p.deliveredAt,
            p.createdAt,
            p.updatedAt,
        ], { operation: 'shipments.insert' });
    }
    async updateShipment(transaction, shipment) {
        const p = shipment.toProps();
        await transaction.query(`UPDATE shipments SET
         carrier = $3,
         service = $4,
         tracking_number = $5,
         status = $6,
         shipped_at = $7,
         delivered_at = $8,
         updated_at = $9
       WHERE tenant_id = $1 AND id = $2`, [
            p.tenantId,
            p.id,
            p.carrier,
            p.service,
            p.trackingNumber,
            p.status,
            p.shippedAt,
            p.deliveredAt,
            p.updatedAt,
        ], { operation: 'shipments.update' });
    }
    async insertShipmentLine(transaction, line) {
        const p = line.toProps();
        await transaction.query(`INSERT INTO shipment_lines (
         id, tenant_id, shipment_id, order_line_id, quantity, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6)`, [p.id, p.tenantId, p.shipmentId, p.orderLineId, p.quantity, p.createdAt], { operation: 'shipment_lines.insert' });
    }
    async listShipmentLines(queryable, tenantId, shipmentId) {
        const result = await queryable.query(`SELECT ${shipmentLineSelect}
       FROM shipment_lines
       WHERE tenant_id = $1 AND shipment_id = $2
       ORDER BY created_at`, [tenantId, shipmentId], { operation: 'shipment_lines.list' });
        return result.rows.map((row) => toShipmentLine(parseOrThrow(shipmentLineRowSchema, row, 'shipment_lines row')));
    }
    async lockShipmentForUpdate(transaction, tenantId, shipmentId) {
        const result = await transaction.query(`SELECT ${shipmentSelect}
       FROM shipments
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`, [tenantId, shipmentId], { operation: 'shipments.lock_for_update' });
        const row = result.rows[0];
        if (row === undefined)
            return null;
        return toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'));
    }
}
