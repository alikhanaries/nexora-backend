# ADR-002: PostgreSQL as Source of Truth

## Status

Accepted — implemented in Phase 1.

## Context

Business state must survive restarts, scale horizontally, and support ACID transactions with row-level security.

## Decision

PostgreSQL is the authoritative store for all durable application state. Redis, BullMQ, and object storage are supporting infrastructure only.

## Consequences

- Repositories use `pg` with explicit SQL (`PostgresDatabase`, migration runner).
- Idempotency, outbox, and inbox tables live in PostgreSQL.
- Cache entries are always reconstructible from PostgreSQL.
