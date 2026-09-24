# ADR-027: Phase 14 Shipment Fulfillment Inventory Integration

**Status:** Accepted (specification — implementation pending)  
**Date:** 2026-09-24

## Context

Phases 3–4 delivered a PostgreSQL-authoritative inventory engine ([ADR-013](ADR-013-inventory-concurrency.md), [ADR-016](ADR-016-phase-4-commerce-contracts.md)) with `reserve` / `release`, reference-based idempotency, and transactional outbox events. [ADR-017](ADR-017-phase-4-orders-fulfillment.md) wires **reserve on order creation** and **release on cancellation**; returns use **`recordReturn` on receive** ([`receive-return.js`](../../src/modules/returns/application/receive-return.js)).

Shipments already update order-line `shippedQuantity` at **`CreateShipment`** ([`create-shipment.js`](../../src/modules/shipments/application/create-shipment.js)) and transition to **`SHIPPED`** via **`ShipShipment`** or compatibility **`UpdateShipmentTracking`** ([`ship-shipment.js`](../../src/modules/shipments/application/ship-shipment.js), [`update-shipment-tracking.js`](../../src/modules/shipments/application/update-shipment-tracking.js)). **No shipment path calls `InventoryService` today.** `recordSale` exists but is unused from orders/shipments.

[ADR-020](ADR-020-phase-7-channel-inbound-integration.md) **channel-fulfilled** ingest **skips reservation** but still **create + ship** in one transaction ([`create-channel-fulfilled-order.js`](../../src/modules/orders/application/create-channel-fulfilled-order.js)).

Phase 14 closes the gap: **when a shipment is marked shipped, inventory must reflect goods leaving stock**, without duplicating the reservation engine or introducing an `allocated` quantity dimension.

---

## Problem

Reserved stock (`on_hand` unchanged, `reserved` ↑, `available` ↓) must transition to sold/consumed stock (`on_hand` ↓, `reserved` ↓) at the correct fulfillment trigger, safely under concurrency and partial multi-shipment orders, while preserving ADR-013 invariants and ADR-017 cancellation/return semantics.

The current `release()` implementation **always marks the reservation row `RELEASED`** after any release quantity ([`default-inventory-service.js`](../../src/modules/inventory/application/default-inventory-service.js)), which is **incompatible** with partial multi-shipment fulfillment if implemented as `release` + `recordSale` (Option B). Phase 14 therefore requires a **single atomic fulfillment mutation** on the existing model (Option A), not a new `allocated` concept (Option C rejected).

---

## Decision summary

| Topic | Decision |
| ----- | -------- |
| Fulfillment trigger | First transition of shipment status to **`SHIPPED`** (in `ShipShipment` or `UpdateShipmentTracking` when status changes to `SHIPPED`) |
| Reservation vs sale | **Option A** — new `InventoryService.fulfillReservedForShipment` (name fixed in implementation) atomically decrements **`reserved` and `on_hand`**; **`available` unchanged** |
| Option B (`release` + `recordSale`) | **Rejected** for fulfillment — current `release()` closes the reservation row on any partial release |
| Option C (allocation entity) | **Rejected** — no `allocated` column; no `ALLOCATED` status |
| Partial shipments | **Supported** — ADR-017; multiple shipments per order; cumulative fulfillment ≤ order reservation per `(product, stock_location)` |
| Channel-fulfilled | **No reservation** — at `SHIPPED`, use **`recordSale` only** (same transaction, same idempotency rules) |
| Stock location | **`order_line.stock_location_id`** from shipment lines — must match reservation location; no silent relocation |
| Movement | Existing **`SALE`** movement type |
| Events | Existing **`inventory.inventory_changed`** (no new catalog types) |
| HTTP | **No new public inventory endpoints** — orchestration inside shipment use cases |
| Orchestration owner | **`ShipShipment`**, **`UpdateShipmentTracking`** (on → `SHIPPED`), and **`CreateChannelFulfilledOrder`** (already calls ship in-tx) |

---

## 1. Fulfillment trigger

### Canonical trigger

Inventory consumption runs in the **same PostgreSQL transaction** as the shipment **status transition to `SHIPPED`**:

1. **`ShipShipment.execute`** — when `previousStatus !== SHIPPED` and updated status is `SHIPPED`.
2. **`UpdateShipmentTracking.execute`** — when tracking update causes `CREATED` / `READY_TO_SHIP` → `SHIPPED` (compatibility Merchant ship path).

### Explicit non-triggers

| Event | Inventory |
| ----- | --------- |
| **`CreateShipment`** (status `CREATED`) | **No consumption** — only order-line `shippedQuantity` accounting (existing) |
| **`DeliverShipment`**, **`IN_TRANSIT`** | **No additional consumption** — goods already left stock at `SHIPPED` |
| **`CancelShipment`** while `CREATED` / `READY_TO_SHIP` | **No consumption reversal** — nothing was consumed at ship; order `reverseShipmentQuantities` only (existing) |

**Rationale:** Shipment `CREATED` represents a fulfillment record and order-line allocation, not necessarily physical dispatch. `SHIPPED` is the domain event aligned with stock leaving the location ([`Shipment.ship()`](../../src/modules/shipments/domain/shipment.js)). Channel-fulfilled flows already call `ShipShipment` immediately after create in one transaction, so inventory still updates at ship without changing ADR-020 sequencing.

---

## 2. Relationship between `reserve`, fulfillment, and `recordSale`

### Merchant-fulfilled orders (reservation exists)

Use **`fulfillReservedForShipment`** (new public method on `InventoryService`):

- Input includes: `tenantId`, `stockLocationId`, `productId`, `quantity`, **`referenceType: 'ORDER'`**, **`referenceId: orderId`**, plus **shipment idempotency** fields (§5).
- Under `SELECT … FOR UPDATE` on `inventory_balances`:
  - Validate active ORDER reservation for `(tenant_id, order_id, stock_location_id, product_id)` with **remaining quantity ≥ fulfill quantity**.
  - `reserved' = reserved - quantity`
  - `on_hand' = on_hand - quantity`
  - `available' = on_hand' - reserved'` (equals previous `available` when both decrease equally)
- Update **`inventory_reservations.quantity`** (decrement); set status **`RELEASED`** only when quantity reaches **0**.
- Append **`SALE`** movement; audit + **`inventory.inventory_changed`** outbox in same transaction.

This is **not** an `allocate()` operation and does not introduce a third balance bucket.

### Channel-fulfilled orders (no reservation)

Per ADR-020, **no `reserve` at ingest**. At the same **`SHIPPED`** trigger, call existing **`recordSale`** with:

- `referenceType: 'SHIPMENT'`, `referenceId: shipmentId`
- `stockLocationId` / `productId` / `quantity` from each shipment line
- Idempotency per §5

`recordSale` only adjusts `on_hand` and `available` (reserved unchanged).

### `release()` role unchanged

- **Cancellation** of unshipped quantity — existing **`release`** with `ORDER` or `CANCELLATION` reference ([`create-cancellation.js`](../../src/modules/cancellations/application/create-cancellation.js)).
- **Not** used to “convert” reservation to sale at shipment.

---

## 3. Quantity transitions

Invariant (unchanged): **`available = on_hand - reserved`**.

### Example — full fulfillment from reservation

Before order ship (after reserve 4):

```text
on_hand = 10
reserved = 4
available = 6
```

**`fulfillReservedForShipment` quantity 4:**

```text
on_hand = 6
reserved = 0
available = 6
```

Reservation row: quantity **0**, status **`RELEASED`**.

### Example — partial fulfillment (first of two shipments)

Before (reserved 10 for order):

```text
on_hand = 20
reserved = 10
available = 10
```

Ship **4** units (shipment A → `SHIPPED`):

```text
on_hand = 16
reserved = 6
available = 10
```

Ship remaining **6** (shipment B → `SHIPPED`):

```text
on_hand = 10
reserved = 0
available = 10
```

### Example — insufficient reservation

If fulfill quantity exceeds remaining reservation or `reserved` balance, throw **`BusinessRuleError`** (same class as insufficient reserve); transaction rolls back; shipment status must not commit (orchestrator calls inventory **before** persisting terminal shipment state, or rolls back entire tx).

### Cancellation before shipment

Unchanged ADR-017: **`release`** on cancellable quantity only (`cancellableQuantity` excludes shipped). Released units restore **`available`**; **`on_hand`** unchanged.

### Cancellation after partial shipment

Order cancellation only applies to **cancellable** quantity ([`order-line.cancellableQuantity()`](../../src/modules/orders/domain/order-line.js) = `quantity - cancelled - shipped`). Already-**fulfilled** units are **not** released via `release()`; reversing them requires **return** flow (below).

### Return after shipment

Unchanged ADR-017 / existing code: **`recordReturn`** at return **RECEIVED**, increases **`on_hand`** and **`available`**, does not restore **`reserved`**. Return location = **`order_line.stock_location_id`**.

---

## 4. Partial shipments

ADR-017 **supports multiple shipments per order**. Each shipment line references an **`orderLineId`** and **quantity**.

Rules:

1. Fulfillment at **`SHIPPED`** processes **each shipment line** independently.
2. Per line, `quantity` must not exceed **remaining** fulfillable reservation for `(orderId, productId, stockLocationId)` aggregated across the order (see §8 for line/location rules).
3. Sum of fulfilled quantities across all **`SHIPPED`** shipments for a given `(order, product, location)` must not exceed the **original ORDER reservation** quantity for that tuple.
4. **Double consumption** prevented by shipment-scoped idempotency (§5) and balance row locking (§13).

**Shipment cancel (`CREATED` / `READY_TO_SHIP` only):** No inventory was consumed; **`reverseShipmentQuantities`** only — no inventory call.

---

## 5. Shipment idempotency

Canonical keys (per shipment line):

| Layer | Key |
| ----- | --- |
| Movement / mutation | `referenceType = 'SHIPMENT'`, `referenceId = shipmentId`, `idempotencyKey = shipmentLineId` (UUID), `movementType = 'SALE'` |
| Retry of same ship operation | Second call finds existing movement → **idempotent success**, no double decrement |

HTTP idempotency on shipment commands (existing ledger) remains separate; inventory idempotency **must** still hold if `ShipShipment` is retried without HTTP replay.

**Duplicate `ShipShipment`** when already `SHIPPED`: no status change → **no inventory side effects** (guard on `previousStatus !== updated.status`).

---

## 6. Cancellation after shipment

| Scenario | Inventory behavior |
| -------- | ------------------- |
| Cancel **unshipped** units | Existing **`release`** (cancellation path) |
| Cancel **shipped** units | **Out of scope** for cancellation — order not cancellable beyond `cancellableQuantity`; use **returns** |
| Order **CANCELLED** after partial ship | Release only **unshipped reserved** portion; fulfilled stock already left via **`SALE`** |

Do **not** call `release()` for quantities already fulfilled via **`fulfillReservedForShipment`**.

---

## 7. Returns

**No change** to Phase 14 return semantics ([ADR-017](ADR-017-phase-4-orders-fulfillment.md)):

- **`recordReturn`** on return receive restores **`on_hand`** / **`available`**
- Does not re-create ORDER reservations automatically (product decision deferred — see §Open decisions)

---

## 8. Stock locations

1. **Reservation location** is fixed at order create from each line’s **`stockLocationId`** ([`create-order.js`](../../src/modules/orders/application/create-order.js)); channel ingest uses **`defaultStockLocationId`** / compatibility resolution ([ADR-022](ADR-022-phase-9-channel-default-stock-location.md)) **before** reserve.
2. **Fulfillment** uses **`order_line.stock_location_id`** for the shipment line’s order line — **must equal** the location on the active ORDER reservation for that product.
3. If shipment line location ≠ reservation location → **`BusinessRuleError`** (no silent transfer).
4. Shipment APIs do not accept an override stock location in Phase 14.

---

## 9. Inventory movements

Use existing **`SALE`** movement ([`0015_inventory.sql`](../../src/infrastructure/postgres/migrations/0015_inventory.sql)):

- `reference_type = 'SHIPMENT'`
- `reference_id = shipmentId`
- `idempotency_key = shipmentLineId`
- `quantity` = fulfilled units (positive integer)

No new movement types in Phase 14.

---

## 10. Events / outbox

- Emit existing **`inventory.inventory_changed`** with balance snapshot (same pattern as `recordSale` / `recordReturn` in [`default-inventory-service.js`](../../src/modules/inventory/application/default-inventory-service.js)).
- Do **not** emit **`inventory.inventory_released`** for fulfillment consumption (stock is sold, not released to available pool).
- Shipment events (`shipment.shipped`, etc.) remain owned by shipment module; inventory and shipment outbox rows commit in the **same transaction** when orchestrated from shipment use case.

---

## 11. Module boundaries

```text
ShipShipment / UpdateShipmentTracking / CreateChannelFulfilledOrder
        ↓
InventoryService (public): fulfillReservedForShipment | recordSale
        ↓
PostgresInventoryRepository (module-internal)
```

- **Shipments** may depend on **`InventoryService`** and **`OrderQueryService`** (for lines).
- **Inventory** must **not** import shipments.
- Fulfillment logic lives in **inventory application service**; shipment use cases **orchestrate** calls inside their existing transactions (`transaction` parameter or `database.execute`).

---

## 12. API changes

**None required.** Existing:

- `POST /api/v1/orders/:orderId/shipments` + ship endpoint
- Compatibility create/tracking routes

trigger lifecycle; inventory is internal.

---

## 13. Concurrency

Preserve [ADR-013](ADR-013-inventory-concurrency.md):

- All fulfillment paths lock **`inventory_balances`** with **`FOR UPDATE`** before read/write.
- Shipment row should remain locked via existing **`lockShipmentForUpdate`** in the same transaction.
- Concurrent **`ShipShipment`** on two shipments for the same `(product, location)` serialize on the balance row; second fails if reservation remainder insufficient.
- Concurrent **cancellation release** and **fulfillment** serialize on the same balance row; invariants enforced in SQL checks.

---

## 14. Failure / rollback

Single PostgreSQL transaction per ship operation (existing pattern):

| Failure | Outcome |
| ------- | ------- |
| Inventory fails | Entire transaction rolls back — shipment status not `SHIPPED`, outbox not committed |
| Shipment update fails after inventory | Rolls back — no partial inventory |
| Outbox insert fails | Rolls back inventory + shipment |
| Duplicate idempotent retry | Success without double mutation |

No distributed transactions.

---

## 15. Acceptance criteria (implementation phase)

1. Full shipment consumes reserved stock exactly once per shipment line at `SHIPPED`.
2. Partial multi-shipment orders follow §3 quantity semantics.
3. Duplicate ship / retry does not double-consume (§5).
4. Cancellation before ship still releases via existing `release()` only for cancellable qty.
5. Cancellation does not `release()` already fulfilled qty.
6. Returns unchanged — `recordReturn` on receive.
7. `on_hand`, `reserved`, `available` never violate CHECK constraints.
8. Cross-tenant access impossible (RLS + explicit `tenantId`).
9. Fulfillment uses order line stock location matching ORDER reservation.
10. `SALE` movements recorded with SHIPMENT reference + line idempotency key.
11. `inventory.inventory_changed` transactional with mutation.
12. Concurrent fulfillment cannot oversell reservation remainder.
13. Existing `reserve` behavior unchanged.
14. Order create reservation unchanged.
15. Cancellation / return paths unchanged except documented fulfillment integration.

---

## 16. Implementation scope (future PR)

Expected touch points (minimal):

| Area | Change |
| ---- | ------ |
| `InventoryService` / `DefaultInventoryService` | Add **`fulfillReservedForShipment`**; extend reservation repo to **decrement quantity** |
| `postgres-inventory-repository.js` | `decrementReservationQuantity` or equivalent |
| `ShipShipment`, `UpdateShipmentTracking` | After status → `SHIPPED`, load lines, call inventory per line |
| `CreateChannelFulfilledOrder` | Ensure **`recordSale`** at ship (no reservation path) |
| `src/modules/inventory/README.md` | Document new method |
| Tests | Unit + PostgreSQL integration: partial ship, concurrency, idempotency, channel-fulfilled, tenant isolation |

**No schema migration** required if `inventory_reservations.quantity` is already decremented in application logic (column exists). If implementation prefers DB constraint on partial reservations, add migration in implementation PR only.

**Non-goals:** new reservation engine, `allocated` quantity, marketplace sync, new HTTP inventory routes, webhook/worker changes.

---

## 17. Open decisions (product / follow-up)

These do **not** block the architecture above but should be confirmed before edge-case implementation:

1. **Return restock + re-reserve:** Should receiving a return re-hold stock for the open order, or only increase `on_hand`? (Current code: **`recordReturn` only**.)
2. **ORDER reservation granularity:** Multiple order lines sharing `(productId, stockLocationId)` rely on one reservation row per ADR-013 unique key — order create currently reserves **per line**; conflicting duplicates throw **409**. Document operational constraint or aggregate reserves in a future change.
3. **Shipped shipment reversal:** Domain disallows cancelling **`SHIPPED`** shipments; inventory reversal for mis-ships is **undefined** (adjustment / return-only?).

---

## Related

- [ADR-013](ADR-013-inventory-concurrency.md)
- [ADR-016](ADR-016-phase-4-commerce-contracts.md)
- [ADR-017](ADR-017-phase-4-orders-fulfillment.md)
- [ADR-020](ADR-020-phase-7-channel-inbound-integration.md)
- [ADR-022](ADR-022-phase-9-channel-default-stock-location.md)
- [src/modules/inventory/README.md](../../src/modules/inventory/README.md)
