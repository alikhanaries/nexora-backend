/**
 * Idempotency port.
 *
 * PostgreSQL is the source of truth. Redis may be used as a short-lived guard
 * in infrastructure, but never as the replay ledger.
 */
export {};
