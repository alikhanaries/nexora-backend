import { z } from 'zod';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import type { StockLocationRepository } from '../application/ports/stock-location-repository.js';
import { StockLocation } from '../domain/stock-location.js';
import { StockLocationStatus } from '../domain/stock-location-status.js';

const stockLocationRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  external_reference: z.string().nullable(),
  status: z.enum([StockLocationStatus.ACTIVE, StockLocationStatus.INACTIVE]),
  created_at: z.date(),
  updated_at: z.date(),
});

function toStockLocation(row: z.infer<typeof stockLocationRowSchema>): StockLocation {
  return StockLocation.reconstitute({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    externalReference: row.external_reference,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class PostgresStockLocationRepository implements StockLocationRepository {
  async findById(
    queryable: Queryable,
    tenantId: string,
    id: string,
  ): Promise<StockLocation | null> {
    const result = await queryable.query(
      `SELECT id, tenant_id, name, external_reference, status, created_at, updated_at
       FROM stock_locations
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
      { operation: 'inventory.stock_locations.find_by_id' },
    );

    const row = result.rows[0];
    if (row === undefined) return null;

    return toStockLocation(parseOrThrow(stockLocationRowSchema, row, 'stock_locations row'));
  }

  async list(queryable: Queryable, tenantId: string): Promise<readonly StockLocation[]> {
    const result = await queryable.query(
      `SELECT id, tenant_id, name, external_reference, status, created_at, updated_at
       FROM stock_locations
       WHERE tenant_id = $1
       ORDER BY name ASC, id ASC`,
      [tenantId],
      { operation: 'inventory.stock_locations.list' },
    );

    return result.rows.map((row) =>
      toStockLocation(parseOrThrow(stockLocationRowSchema, row, 'stock_locations row')),
    );
  }

  async insert(transaction: Transaction, location: StockLocation): Promise<void> {
    await transaction.query(
      `INSERT INTO stock_locations
         (id, tenant_id, name, external_reference, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        location.id,
        location.tenantId,
        location.name,
        location.externalReference,
        location.status,
        location.createdAt,
        location.updatedAt,
      ],
      { operation: 'inventory.stock_locations.insert' },
    );
  }
}
