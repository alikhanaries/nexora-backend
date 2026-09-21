import type { Queryable, Transaction } from '../../../../shared/persistence/index.js';
import type { InventoryBalance } from '../../domain/inventory-balance.js';
import type { InventoryReservation } from '../../domain/reservation.js';
import type { MovementType } from '../../domain/movement-type.js';

export interface InsertMovementInput {
  readonly id: string;
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly movementType: MovementType;
  readonly quantity: number;
  readonly referenceType?: string | null;
  readonly referenceId?: string | null;
  readonly idempotencyKey?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly occurredAt?: Date;
}

export interface InsertReservationInput {
  readonly id: string;
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly quantity: number;
}

export interface InventoryRepository {
  listBalances(
    queryable: Queryable,
    tenantId: string,
    filters: { readonly productId?: string; readonly stockLocationId?: string },
  ): Promise<readonly InventoryBalance[]>;

  ensureBalanceRow(
    transaction: Transaction,
    tenantId: string,
    stockLocationId: string,
    productId: string,
    balanceId: string,
  ): Promise<void>;

  lockBalanceForUpdate(
    transaction: Transaction,
    tenantId: string,
    stockLocationId: string,
    productId: string,
  ): Promise<InventoryBalance>;

  updateBalance(
    transaction: Transaction,
    balanceId: string,
    values: { readonly onHand: number; readonly reserved: number; readonly available: number },
    updatedAt: Date,
  ): Promise<void>;

  insertMovement(transaction: Transaction, input: InsertMovementInput): Promise<boolean>;

  insertReservation(
    transaction: Transaction,
    input: InsertReservationInput,
  ): Promise<{ readonly inserted: boolean; readonly reservation: InventoryReservation }>;

  findReservationByReference(
    transaction: Transaction,
    tenantId: string,
    referenceType: string,
    referenceId: string,
    stockLocationId: string,
    productId: string,
  ): Promise<InventoryReservation | null>;

  markReservationReleased(
    transaction: Transaction,
    reservationId: string,
    releasedAt: Date,
  ): Promise<void>;
}
