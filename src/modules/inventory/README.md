# Inventory Module

PostgreSQL-authoritative tenant inventory with stock locations, balances, append-only movements, and reference-based reservations.

## Domain model

| Concept        | Table                    | Notes                                                |
| -------------- | ------------------------ | ---------------------------------------------------- |
| Stock location | `stock_locations`        | Tenant-owned warehouse/shelf. `ACTIVE` / `INACTIVE`. |
| Balance        | `inventory_balances`     | One row per `(tenant, location, product)`.           |
| Movement       | `inventory_movements`    | Append-only audit trail of quantity changes.         |
| Reservation    | `inventory_reservations` | Tracks active holds by business reference.           |

### Balance invariant

```
available = on_hand - reserved
```

All three counters are stored and enforced by PostgreSQL `CHECK` constraints. Every mutation updates `on_hand`, `reserved`, and `available` together inside a single transaction so the invariant cannot drift.

Negative `on_hand`, `reserved`, or `available` values are rejected.

## Concurrency model

Inventory correctness is enforced in PostgreSQL, not Redis.

1. **Row lock** — `reserve`, `release`, and on-hand mutations call `SELECT … FOR UPDATE` on the authoritative `inventory_balances` row before reading or writing quantities.
2. **Transaction scope** — balance update, movement insert, reservation row change, audit, and outbox event commit atomically.
3. **Parallel reservations** — concurrent requests for the same product/location serialize on the balance row; only one proceeds when available stock is insufficient for both.

Example: available = 5. Request A reserves 4 and request B reserves 3 concurrently. One succeeds; the other receives `422 INSUFFICIENT_INVENTORY` (business rule violation).

## Reservation semantics

- `reserve` increases `reserved` and decreases `available`; `on_hand` is unchanged.
- `release` decreases `reserved` and increases `available`; `on_hand` is unchanged. A full release marks the reservation `RELEASED`.
- A reservation is keyed by `(tenant_id, reference_type, reference_id, stock_location_id, product_id)`.
- **Idempotent reserve** — `INSERT … ON CONFLICT DO NOTHING` on `inventory_reservations`. If an `ACTIVE` row already exists with the same quantity, the call returns success without double-reserving. A conflicting quantity returns `409 CONFLICT`.
- **Idempotent release** — if the reservation is already `RELEASED`, the call returns success without mutating balances again.
- **Cannot over-release** — release quantity must not exceed the reservation quantity or current `reserved` balance.

## Shipment fulfillment lifecycle (ADR-027)

Normal commerce orders **reserve on order creation** (`reference_type = ORDER`, `reference_id = order id`). Physical stock is **not** consumed at reservation time.

When a shipment first becomes **`SHIPPED`**, reserved stock for that shipment line is fulfilled:

| Operation | `on_hand` | `reserved` | `available` | Reservation row |
| --------- | --------- | ---------- | ----------- | ----------------- |
| `reserve` (order create) | unchanged | ↑ | ↓ (= on_hand − reserved) | `ACTIVE`, full line qty |
| **`fulfillReservedForShipment`** (ship) | ↓ | ↓ (same qty) | unchanged | qty decremented; `RELEASED` only when qty → 0 |
| `release` (cancellation before ship) | unchanged | ↓ | ↑ | partial or full release per existing rules |

- **Partial shipments** — each ship call fulfills only the shipment line quantity. The ORDER reservation stays **`ACTIVE`** until its remaining quantity reaches zero.
- **Do not** use `release()` + `recordSale()` for shipped normal orders; partial fulfillment requires `fulfillReservedForShipment`.
- Fulfillment records a **`SALE`** movement with `reference_type = SHIPMENT`, `reference_id = shipment id`, and `idempotency_key = shipment line id` (retries are safe).
- Stock location is always the **order line’s `stock_location_id`**, which must match the ORDER reservation location.

**Channel-fulfilled orders (ADR-020)** do **not** reserve inventory. When their shipment is marked `SHIPPED`, the shipments layer calls **`recordSale`** only (`on_hand` ↓, `reserved` unchanged).

## Idempotency

Two layers:

1. **Business reference** (`reference_type` + `reference_id`) on `inventory_reservations` for reserve/release deduplication.
2. **Optional `idempotency_key`** on movements via partial unique index `(tenant_id, reference_type, reference_id, movement_type, idempotency_key)` for HTTP/API retries on adjust/receive/reserve/release.

## Public contract: `InventoryService`

Exported from `public/index.ts` for cross-module use (Orders, Offers, etc.).

| Method                         | Purpose                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| `getAvailability`              | Read balances for a product (optionally scoped to one location).       |
| `reserve`                      | Hold stock for a business reference (orders at creation).               |
| `release`                      | Undo an active reservation (e.g. cancellation before ship).            |
| **`fulfillReservedForShipment`** | Consume reserved + on-hand for a shipped order line (partial OK).   |
| `adjust`                       | Signed delta adjustment (`ADJUSTMENT` movement).                        |
| `receive`                      | Increase on-hand (`RECEIPT`).                                           |
| `recordSale`                   | Decrease on-hand only (`SALE`) — channel-fulfilled ship, no reservation. |
| `recordReturn`                 | Increase on-hand (`RETURN`) — returns receive path.                     |

All mutating methods accept an optional `Transaction` so callers can participate in a larger unit of work. When omitted, the service opens its own tenant-scoped transaction (`app.tenant_id` set for RLS).

### Dependencies

- **Products only** — `ProductQueryService.verifyProductBelongsToTenant` validates product existence before any mutation.
- No direct access to product tables or repositories.

## Authorization

| Permission          | Operations                            |
| ------------------- | ------------------------------------- |
| `inventory.read`    | List/get stock locations and balances |
| `inventory.adjust`  | Create locations, adjust, receive     |
| `inventory.reserve` | Reserve and release                   |

## HTTP routes

| Method | Path                                       |
| ------ | ------------------------------------------ |
| GET    | `/api/v1/stock-locations`                  |
| POST   | `/api/v1/stock-locations`                  |
| GET    | `/api/v1/stock-locations/:stockLocationId` |
| GET    | `/api/v1/inventory`                        |
| GET    | `/api/v1/inventory/:productId`             |
| POST   | `/api/v1/inventory/adjustments`            |
| POST   | `/api/v1/inventory/receipts`               |
| POST   | `/api/v1/inventory/reservations`           |
| POST   | `/api/v1/inventory/releases`               |

## Events

Transactional outbox events (written in the same transaction as the mutation):

- `inventory.inventory_changed` — adjust, receive, sale, return
- `inventory.inventory_reserved`
- `inventory.inventory_released`
