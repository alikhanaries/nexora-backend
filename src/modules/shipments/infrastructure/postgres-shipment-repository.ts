import { z } from 'zod';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { ShipmentLine } from '../domain/shipment-line.js';
import { Shipment } from '../domain/shipment.js';
import { ShipmentStatus } from '../domain/shipment-status.js';
import type {
  ShipmentListFilters,
  ShipmentRepository,
} from '../domain/shipment-repository.port.js';

const shipmentRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
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

const shipmentSelect = `id, tenant_id, order_id, carrier, service, tracking_number, status,
  shipped_at, delivered_at, created_at, updated_at`;

const shipmentLineSelect = `id, tenant_id, shipment_id, order_line_id, quantity, created_at`;

function toShipment(row: z.infer<typeof shipmentRowSchema>): Shipment {
  return Shipment.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
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

function toShipmentLine(row: z.infer<typeof shipmentLineRowSchema>): ShipmentLine {
  return ShipmentLine.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    shipmentId: row.shipment_id,
    orderLineId: row.order_line_id,
    quantity: row.quantity,
    createdAt: row.created_at,
  });
}

export class PostgresShipmentRepository implements ShipmentRepository {
  async findById(
    queryable: Queryable,
    tenantId: string,
    shipmentId: string,
  ): Promise<Shipment | null> {
    const result = await queryable.query(
      `SELECT ${shipmentSelect} FROM shipments WHERE tenant_id = $1 AND id = $2`,
      [tenantId, shipmentId],
      { operation: 'shipments.find_by_id' },
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'));
  }

  async listPage(
    queryable: Queryable,
    tenantId: string,
    filters: ShipmentListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Shipment[] }> {
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

    if (filters.trackingNumber !== undefined) {
      parameters.push(filters.trackingNumber);
      conditions.push(`tracking_number = $${parameters.length}`);
    }

    if (cursorCreatedAt !== null && cursorId !== null) {
      parameters.push(cursorCreatedAt, cursorId);
      conditions.push(`(created_at, id) < ($${parameters.length - 1}, $${parameters.length})`);
    }

    parameters.push(limit);

    const result = await queryable.query(
      `SELECT ${shipmentSelect}
       FROM shipments
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $${parameters.length}`,
      parameters,
      { operation: 'shipments.list_page' },
    );

    return {
      items: result.rows.map((row) =>
        toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row')),
      ),
    };
  }

  async insertShipment(transaction: Transaction, shipment: Shipment): Promise<void> {
    const p = shipment.toProps();
    await transaction.query(
      `INSERT INTO shipments (
         id, tenant_id, order_id, carrier, service, tracking_number, status,
         shipped_at, delivered_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        p.id,
        p.tenantId,
        p.orderId,
        p.carrier,
        p.service,
        p.trackingNumber,
        p.status,
        p.shippedAt,
        p.deliveredAt,
        p.createdAt,
        p.updatedAt,
      ],
      { operation: 'shipments.insert' },
    );
  }

  async updateShipment(transaction: Transaction, shipment: Shipment): Promise<void> {
    const p = shipment.toProps();
    await transaction.query(
      `UPDATE shipments SET
         carrier = $3,
         service = $4,
         tracking_number = $5,
         status = $6,
         shipped_at = $7,
         delivered_at = $8,
         updated_at = $9
       WHERE tenant_id = $1 AND id = $2`,
      [
        p.tenantId,
        p.id,
        p.carrier,
        p.service,
        p.trackingNumber,
        p.status,
        p.shippedAt,
        p.deliveredAt,
        p.updatedAt,
      ],
      { operation: 'shipments.update' },
    );
  }

  async insertShipmentLine(transaction: Transaction, line: ShipmentLine): Promise<void> {
    const p = line.toProps();
    await transaction.query(
      `INSERT INTO shipment_lines (
         id, tenant_id, shipment_id, order_line_id, quantity, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.id, p.tenantId, p.shipmentId, p.orderLineId, p.quantity, p.createdAt],
      { operation: 'shipment_lines.insert' },
    );
  }

  async listShipmentLines(
    queryable: Queryable,
    tenantId: string,
    shipmentId: string,
  ): Promise<readonly ShipmentLine[]> {
    const result = await queryable.query(
      `SELECT ${shipmentLineSelect}
       FROM shipment_lines
       WHERE tenant_id = $1 AND shipment_id = $2
       ORDER BY created_at`,
      [tenantId, shipmentId],
      { operation: 'shipment_lines.list' },
    );
    return result.rows.map((row) =>
      toShipmentLine(parseOrThrow(shipmentLineRowSchema, row, 'shipment_lines row')),
    );
  }

  async lockShipmentForUpdate(
    transaction: Transaction,
    tenantId: string,
    shipmentId: string,
  ): Promise<Shipment | null> {
    const result = await transaction.query(
      `SELECT ${shipmentSelect}
       FROM shipments
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [tenantId, shipmentId],
      { operation: 'shipments.lock_for_update' },
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toShipment(parseOrThrow(shipmentRowSchema, row, 'shipments row'));
  }
}
