import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { ShipmentLine } from './shipment-line.js';
import type { Shipment } from './shipment.js';
import type { ShipmentStatus } from './shipment-status.js';

export interface ShipmentListFilters {
  readonly orderId?: string;
  readonly status?: ShipmentStatus;
  readonly trackingNumber?: string;
}

export interface ShipmentRepository {
  findById(queryable: Queryable, tenantId: string, shipmentId: string): Promise<Shipment | null>;
  listPage(
    queryable: Queryable,
    tenantId: string,
    filters: ShipmentListFilters,
    limit: number,
    cursorCreatedAt: Date | null,
    cursorId: string | null,
  ): Promise<{ readonly items: readonly Shipment[] }>;
  insertShipment(transaction: Transaction, shipment: Shipment): Promise<void>;
  updateShipment(transaction: Transaction, shipment: Shipment): Promise<void>;
  insertShipmentLine(transaction: Transaction, line: ShipmentLine): Promise<void>;
  listShipmentLines(
    queryable: Queryable,
    tenantId: string,
    shipmentId: string,
  ): Promise<readonly ShipmentLine[]>;
  lockShipmentForUpdate(
    transaction: Transaction,
    tenantId: string,
    shipmentId: string,
  ): Promise<Shipment | null>;
}
