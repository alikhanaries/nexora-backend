# ADR-013: Inventory Concurrency and Authority

## Status

Accepted

## Context

Inventory is concurrency-sensitive. Phase 4 (Orders) requires reliable reserve/release semantics without oversubscribing available stock. Redis is available for ephemeral infrastructure but must not be the source of inventory correctness.

## Decision

1. **PostgreSQL is authoritative** for inventory balances, reservations, and movements.
2. **Row-level locking** — reserve, release, and on-hand mutations lock the `inventory_balances` row with `SELECT … FOR UPDATE` inside a tenant-scoped transaction before reading or writing quantities.
3. **Derived available** — `available = on_hand - reserved` is maintained transactionally on every mutation. CHECK constraints prevent negative `on_hand`, `reserved`, or `available`.
4. **Reference-based reservations** — each reservation is keyed by `(tenant_id, stock_location_id, product_id, reference_type, reference_id)`. Retries with the same reference return idempotent success without double-reserving.
5. **Append-only movements** — every balance change writes an `inventory_movements` row in the same transaction. Corrections use compensating movements, not updates.

## Consequences

- Concurrent requests cannot oversubscribe available inventory when using the public `InventoryService`.
- Callers may pass an existing transaction to participate in a larger unit of work (e.g. future order creation).
- Phase 4 must use `InventoryService.reserve` / `release` rather than direct repository access.
