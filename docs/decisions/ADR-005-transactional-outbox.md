# ADR-005: Transactional Outbox Pattern

**Status:** Accepted  
**Date:** 2025-09-01

## Context

Integration events must be published when business state changes, but publishing directly inside a request handler creates failure modes:

- Event published, transaction rolls back → phantom event
- Transaction commits, publish fails → lost event

## Decision

Implement the **transactional outbox** pattern:

1. Write business change and `outbox_events` row in the **same PostgreSQL transaction**
2. Separate **OutboxPublisher** process polls unpublished rows and enqueues BullMQ jobs
3. Delivery semantics: **at-least-once** — consumers must deduplicate

Table: `outbox_events` (migration `0002`). Publisher supports claiming, retries, and dead-lettering.

## Consequences

**Positive**

- Events never published for uncommitted transactions
- Survives process crashes — rows remain until successfully published
- Multiple publisher instances safe via row claiming

**Negative**

- Event delivery is delayed by poll interval (default 1 s)
- At-least-once requires inbox/idempotent handlers
- Outbox table requires retention management

## Related

- [events.md](../architecture/events.md)
- [ADR-006](ADR-006-inbox-deduplication.md)
- `src/infrastructure/postgres/outbox-publisher.ts`
