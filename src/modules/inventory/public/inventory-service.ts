import type { Transaction } from '../../../shared/persistence/index.js';

export interface BalanceSnapshot {
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
}

export interface AvailabilityLocation {
  readonly stockLocationId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
}

export interface AvailabilityResult {
  readonly tenantId: string;
  readonly productId: string;
  readonly locations: readonly AvailabilityLocation[];
  readonly totals: BalanceSnapshot;
}

export interface ReserveInput {
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly idempotencyKey?: string;
}

export interface ReserveResult {
  readonly reservationId: string;
  readonly idempotent: boolean;
  readonly balance: BalanceSnapshot;
}

export interface ReleaseInput {
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly quantity?: number;
  readonly idempotencyKey?: string;
}

export interface ReleaseResult {
  readonly reservationId: string;
  readonly idempotent: boolean;
  readonly balance: BalanceSnapshot;
}

export interface AdjustInput {
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly delta: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ReceiveInput {
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SaleInput {
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ReturnInput {
  readonly tenantId: string;
  readonly stockLocationId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly idempotencyKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InventoryMutationResult {
  readonly idempotent: boolean;
  readonly balance: BalanceSnapshot;
}

/**
 * Public inventory contract for cross-module use (Orders, Offers, etc.).
 *
 * All mutating methods accept an optional transaction so callers can participate
 * in a larger unit of work. When omitted, the service opens its own transaction
 * with tenant RLS context.
 *
 * Concurrency: reserve and release lock the authoritative balance row with
 * `SELECT FOR UPDATE`. PostgreSQL is the source of truth for correctness.
 */
export interface InventoryService {
  getAvailability(
    tenantId: string,
    productId: string,
    stockLocationId?: string,
    tx?: Transaction,
  ): Promise<AvailabilityResult>;

  reserve(input: ReserveInput, tx?: Transaction): Promise<ReserveResult>;
  release(input: ReleaseInput, tx?: Transaction): Promise<ReleaseResult>;
  adjust(input: AdjustInput, tx?: Transaction): Promise<InventoryMutationResult>;
  receive(input: ReceiveInput, tx?: Transaction): Promise<InventoryMutationResult>;
  recordSale(input: SaleInput, tx?: Transaction): Promise<InventoryMutationResult>;
  recordReturn(input: ReturnInput, tx?: Transaction): Promise<InventoryMutationResult>;
}
