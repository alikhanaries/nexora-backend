/**
 * Idempotency port.
 *
 * PostgreSQL is the source of truth. Redis may be used as a short-lived guard
 * in infrastructure, but never as the replay ledger.
 */

export interface IdempotencyKey {
  /** Null until Phase 2 tenant resolution exists. */
  readonly tenantId: string | null;
  /** Hash of the authenticated principal; `anonymous` in Phase 1. */
  readonly principalFingerprint: string;
  /** Stable route identifier, e.g. `POST /api/v1/orders`. */
  readonly routeId: string;
  /** Client-supplied idempotency key. */
  readonly idempotencyKey: string;
}

export type RequestFingerprint = string;

export type IdempotencyStatus = 'processing' | 'completed' | 'failed';

export interface IdempotencyRecordResult {
  readonly statusCode: number;
  readonly body: unknown;
}

export type IdempotencyOutcome<T> =
  | { readonly kind: 'executed'; readonly value: T }
  | { readonly kind: 'replayed'; readonly value: T };

export interface IdempotencyService {
  /**
   * Runs `operation` at most once per (key, fingerprint) pair.
   *
   * @throws {IdempotencyConflictError} same key, different fingerprint.
   * @throws {IdempotentRequestInProgressError} concurrent duplicate in flight.
   */
  execute<T>(
    key: IdempotencyKey,
    fingerprint: RequestFingerprint,
    operation: () => Promise<T>,
    toRecord: (value: T) => IdempotencyRecordResult,
  ): Promise<IdempotencyOutcome<T>>;

  purgeExpired(batchSize: number): Promise<number>;
}
