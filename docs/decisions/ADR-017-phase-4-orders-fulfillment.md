# ADR-017: Phase 4 Orders and Fulfillment

## Status

Accepted

## Context

Phase 4 introduces orders, shipments, cancellations, and returns on top of Phase 3 commerce
contracts. Historical accuracy, tenant isolation, inventory safety, and idempotent mutations are
required.

## Decisions

### Customer representation

Orders store an immutable `order_customer_snapshots` row at creation time. There is no global
customer table in Phase 4.

### Order lifecycle

Orders use an explicit state machine (`NEW` → `CONFIRMED` → `PROCESSING` → `READY_TO_SHIP` →
`SHIPPED` → `DELIVERED` → `RETURNED`, with `CANCELLED` from pre-shipment states). HTTP APIs do not
accept arbitrary status patches.

Creation currently lands in `CONFIRMED` with pricing and inventory reserved in the same database
transaction. `POST /api/v1/orders/:orderId/confirm` supports explicit confirmation when an order
is still `NEW`.

### Inventory interaction

- Reserve on order creation (`referenceType=ORDER`, `referenceId=orderId`)
- Release on cancellation completion (`referenceType=CANCELLATION`)
- Restore on return receipt (`referenceType=RETURN`, lifecycle point `RECEIVED`)

Phase 4 never writes Phase 3 inventory tables directly.

### Idempotency

`POST /api/v1/orders` requires `Idempotency-Key` and uses the PostgreSQL idempotency ledger.
Inventory operations additionally use reference-based idempotency inside Phase 3
`InventoryService`.

### Partial fulfillment

Multiple shipments per order are supported. Order `SHIPPED` is derived when all non-cancelled units
are shipped.

### Public contracts

Future phases consume `OrderQueryService`, `OrderFulfillmentService`, `ShipmentQueryService`,
`CancellationQueryService`, and `ReturnQueryService`. Repositories remain module-private except
where explicitly exported for composition wiring.

## Consequences

- Order history remains stable when catalog or pricing changes later.
- Concurrent shipment/cancellation/return operations rely on PostgreSQL row locking.
- Marketplace/carrier integrations remain deferred to Phase 5 and subscribe to outbox events.
