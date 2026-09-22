# ADR-020: Phase 7 Channel & Marketplace Inbound Integration

**Status:** Accepted  
**Date:** 2026-09-22

## Context

Phases 1–6 delivered Nexora's commerce core, Merchant-compatible `/api/v2` outbound flows (poll, acknowledge, ship, cancel, return), and external webhook delivery. Phase 6.6 added infrastructure retention sweeps.

ADR-018 deferred **Channel API** order ingestion to a separate future scope. The verified external contracts are distinct:

| Contract         | Role                        | Example paths                                          |
| ---------------- | --------------------------- | ------------------------------------------------------ |
| **Merchant API** | Merchant poll/ack/fulfil    | `GET /v2/orders/new`, `POST /v2/orders/acknowledge`    |
| **Channel API**  | Marketplace order ingestion | `POST /v2/orders`, `POST /v2/orders/channel-fulfilled` |

The compatibility layer (`src/modules/compatibility/`) already implements Merchant routes. Channel routes are documented in [compatibility.md](../architecture/compatibility.md) and [compatibility-matrix.md](../architecture/compatibility-matrix.md) but not yet implemented.

**Product gap (documented):** Native `POST /api/v1/orders` creates orders in `CONFIRMED` status (`Order.create()` default in `src/modules/orders/domain/order.js`). Merchant `GET /api/v2/orders/new` returns only Nexora `NEW` orders. Without a Channel ingestion path, the Merchant poll/acknowledge loop has no data source for channel-imported orders.

Phase 7.0 resolves design questions **OQ-7-01** through **OQ-7-06** before any implementation (7.1–7.5).

## Problem

Channel inbound integration must:

1. Follow verified Channel API path parity without breaking ADR-018 Merchant boundaries.
2. Populate the existing Merchant `NEW` → acknowledge workflow where merchant-fulfilled.
3. Represent marketplace-fulfilled orders without inventing inventory or state-machine semantics unsupported by the current domain model.
4. Integrate only through existing **public contracts** — no compatibility → repository access.
5. Preserve PostgreSQL RLS, transactional outbox, and HTTP idempotency guarantees.

## Decision

Phase 7 implements **Channel & Marketplace Inbound Connectivity** in sub-phases 7.1–7.5 (see [Implementation sequence](#implementation-sequence-for-715)). Phase 7.0 locks the design decisions below.

---

## API namespace decision (OQ-7-01)

**Decision:** Channel inbound routes use the **verified Channel API paths** on the existing `/api/v2` prefix:

| Method | Nexora route                       | Contract                                  |
| ------ | ---------------------------------- | ----------------------------------------- |
| POST   | `/api/v2/orders`                   | Channel API — order ingestion             |
| POST   | `/api/v2/orders/channel-fulfilled` | Channel API — channel-fulfilled ingestion |

**Do not** introduce a separate namespace such as `/api/v2/channel/orders`.

**Rationale:**

1. **External contract parity** — [compatibility.md](../architecture/compatibility.md) and ADR-018 document Channel ingestion at `POST /v2/orders` and `POST /v2/orders/channel-fulfilled`. A separate namespace would break verified OpenAPI alignment.
2. **No Merchant collision** — The Merchant API does **not** define `POST /v2/orders` ([ADR-018](ADR-018-phase-5-merchant-compatible-scope.md), [compatibility-matrix.md](../architecture/compatibility-matrix.md)). Merchant clients use `GET` and `POST /v2/orders/acknowledge` only. Fastify routes by HTTP method; `POST /api/v2/orders` is Channel-only.
3. **Existing architecture** — The compatibility module already registers all `/api/v2` routes in one plugin (`compatibility.routes.js`) with shared auth, rate limits, and error mapping. Splitting Channel routes to a different prefix would duplicate infrastructure without security benefit.
4. **ADR-018 clarification** — ADR-018 forbids **`POST /api/v2/orders` as a Merchant create endpoint**, not Channel ingestion on the same path. Route handlers must document contract ownership in OpenAPI tags (`Compatibility (v2) — Channel`).

**Rejected alternative:** `/api/v2/channel/orders` — rejected because it diverges from the verified Channel API, would require clients to use non-standard paths, and is not referenced anywhere in current architecture docs.

---

## Order status semantics (OQ-7-02)

**Decision:** Maintain **two distinct creation semantics**:

| Creation path                              | Initial status | Events on create                    | Purpose                                                            |
| ------------------------------------------ | -------------- | ----------------------------------- | ------------------------------------------------------------------ |
| **`POST /api/v1/orders`** (native)         | `CONFIRMED`    | `order.created` + `order.confirmed` | Direct ERP/native order entry — no merchant poll step              |
| **`POST /api/v2/orders`** (Channel ingest) | `NEW`          | `order.created` only                | Channel import — awaits Merchant `POST /api/v2/orders/acknowledge` |

**Rationale:**

- ADR-017 documents native creation landing in `CONFIRMED` with inventory reserved in the same transaction. Changing native behavior would break existing `/api/v1` clients and tests.
- Merchant `GET /api/v2/orders/new` maps external `NEW` ↔ Nexora `OrderStatus.NEW` only ([compatibility-matrix.md](../architecture/compatibility-matrix.md)). Channel ingest must create `NEW` orders to feed this endpoint.
- `ConfirmOrder` / `AcknowledgeOrder` already supports `NEW → CONFIRMED` (idempotent when already `CONFIRMED`) and emits `order.status_changed` + `order.confirmed`.

**Phase 7.1 implementation note:** Extend the public `OrderCommandService.createOrder` contract with an explicit `initialStatus` (or a dedicated `createChannelOrder` method) so Channel ingest can create `NEW` without altering native defaults. Native `/api/v1/orders` remains unchanged.

---

## Channel order line / product resolution (OQ-7-04)

**Decision:** Resolve inbound channel order lines using the following **identifier hierarchy**, applied at the compatibility mapper boundary before calling core public contracts:

| Priority | External field (Channel API) | Core resolution                                                                                              | Notes                                                                                                                                               |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Channel identifier           | `ChannelQueryService`                                                                                        | See gap below                                                                                                                                       |
| 2        | `MerchantProductNo`          | `ProductQueryService.getProductBySku(tenantId, sku)`                                                         | Primary product lookup — matches existing Merchant mapper convention                                                                                |
| 3        | `ChannelProductNo`           | `ProductQueryService.getProductBySku` **first**; if no match, resolve via offer external reference (see gap) | Nexora order lines snapshot `merchantSku` only; no separate channel SKU column ([compatibility-matrix.md](../architecture/compatibility-matrix.md)) |
| 4        | (implicit)                   | `OfferQueryService.getOfferForProductAndChannel(tenantId, productId, channelId)`                             | After product + channel resolved                                                                                                                    |
| 5        | (implicit)                   | `PricingService.getEffectivePrice(...)`                                                                      | Same as native `CreateOrder`                                                                                                                        |
| 6        | Stock location               | See gap below                                                                                                | Required by `CreateOrderLineCommand.stockLocationId`                                                                                                |

**Channel resolution:**

- External Channel API uses integer `ChannelId`. Nexora channels use UUID primary keys with optional `channels.external_reference` (text).
- **Gap (7.1):** `ChannelQueryService` exposes `getChannelById(tenantId, uuid)` only — no `findByExternalReference`. Phase 7.1 must add a **public** method such as `getChannelByExternalReference(tenantId, externalReference)` (or map via a documented tenant configuration convention). Do not bypass the public port from compatibility.

**Offer / channel SKU resolution:**

- `OfferQueryService` exposes `getOfferForProductAndChannel` but **not** lookup by `offer.external_reference`.
- **Gap (7.1):** When `ChannelProductNo ≠ MerchantProductNo`, add a **public** method such as `getOfferByExternalReference(tenantId, channelId, externalReference)` returning the offer (and thus product). Do not add SQL to compatibility.

**Stock location resolution:**

- Native create requires `stockLocationId` (UUID) per line (`order.schemas.js`).
- Channels store `configurationReference` (opaque string) but no structured default stock location.
- **Gap (7.2):** Resolve stock location from (in order): explicit Channel API request field mapped to Nexora UUID via `configurationReference` convention, tenant-configured default on the channel record (may require a future migration), or reject with `422` when unambiguous resolution is impossible. Document the chosen rule in the compatibility-matrix during 7.2.

**Rejected:** Accepting Nexora UUID `productId` on the external Channel API — external contracts use merchant/channel product numbers, not Nexora internal IDs.

---

## Inventory semantics (OQ-7-05)

### Standard Channel ingest (`POST /api/v2/orders`)

**Decision:** **Reserve inventory at ingest time** (same transaction as order creation), consistent with ADR-017 native create behavior.

| Topic                                | Behavior                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **When**                             | During order creation transaction, before commit — same as `CreateOrder` today (`inventoryService.reserve`, `referenceType=ORDER`)                                                                                                                                            |
| **Insufficient stock**               | Reservation fails → entire transaction rolls back → HTTP `422` (`BusinessRuleError` from inventory layer)                                                                                                                                                                     |
| **`NEW` without reservation**        | **Not supported** for merchant-fulfilled channel ingest — a `NEW` order always holds inventory while awaiting acknowledgement                                                                                                                                                 |
| **Acknowledge**                      | `ConfirmOrder` transitions `NEW → CONFIRMED` only — **does not** reserve inventory (reservation already exists)                                                                                                                                                               |
| **Acknowledge failure due to stock** | **Not applicable** — stock was validated at ingest; acknowledge cannot fail for inventory reasons unless reservation was released externally (out of scope)                                                                                                                   |
| **Idempotency**                      | HTTP `Idempotency-Key` + PostgreSQL ledger ([compatibility-idempotency.md](../architecture/compatibility-idempotency.md)); duplicate `(tenant_id, channel_id, external_order_reference)` returns existing order (DB unique index `orders_tenant_channel_external_ref_unique`) |
| **Concurrency**                      | Row-level locking in `CreateOrder` + inventory `lock_for_update`; overlapping ingests for same external ref serialize on unique index                                                                                                                                         |

**Rationale:** ADR-017 mandates reserve-on-create. Deferring reservation to acknowledge would require splitting `CreateOrder` and changing inventory reference semantics — larger change with no documented requirement. Holding stock during the `NEW` polling window matches merchant-fulfillment expectations.

### Channel-fulfilled ingest (`POST /api/v2/orders/channel-fulfilled`)

**Decision:** **Do not reserve inventory.** Fulfillment occurs outside the tenant's Nexora-managed warehouse; no stock should be held or deducted from merchant locations.

---

## Channel-fulfilled semantics (OQ-7-03)

**Decision:** Channel-fulfilled ingestion represents orders **already shipped by the marketplace/channel**. Semantics must fit the existing order and shipment state machines without illegal transitions.

### Order

| Aspect                                      | Decision                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Initial status**                          | `CONFIRMED` — auto-confirmed at ingest; **not** `NEW` (no merchant acknowledge step)                                                                                                         |
| **Final status (full shipment in payload)** | `SHIPPED` after fulfillment side effects complete                                                                                                                                            |
| **Partial shipment in payload**             | Order advances only as far as existing `evaluateOrderShipmentState` allows; may remain below `SHIPPED` until fully shipped                                                                   |
| **State machine**                           | Use legal transitions only: `CONFIRMED → PROCESSING → READY_TO_SHIP → SHIPPED` via existing `DefaultOrderFulfillmentService.evaluateOrderShipmentState` — **no** direct `NEW → SHIPPED` jump |

### Shipment

| Aspect                      | Decision                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-create shipment**    | **Yes** — one shipment per ingest request (matching compatibility.md: "Create channel-fulfilled order + shipment")                                                  |
| **Initial shipment status** | `CREATED` via `ShipmentCommandService.createShipment`, then **`SHIPPED`** via `ShipShipment` in the same database transaction when tracking/carrier data is present |
| **Order line quantities**   | `OrderFulfillmentService.applyShipmentQuantities` records shipped quantities on order lines (same as Merchant `POST /api/v2/shipments`)                             |
| **Inventory**               | **Skipped** — no `inventoryService.reserve` call                                                                                                                    |

### Events emitted (single successful transaction)

| Event                     | When                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `order.created`           | Order inserted                                                                                        |
| `order.confirmed`         | Order created in `CONFIRMED` status (same pattern as native create — order exists in confirmed state) |
| `shipment.created`        | Shipment inserted (`CreateShipment`)                                                                  |
| `shipment.shipped`        | Shipment transitioned to `SHIPPED` (`ShipShipment`)                                                   |
| `shipment.status_changed` | Shipment status transitions                                                                           |
| `order.status_changed`    | When `evaluateOrderShipmentState` advances order toward `SHIPPED`                                     |

**Not emitted at ingest:** `order.cancelled`, `shipment.delivered` (unless future payload includes delivery confirmation — deferred).

**Phase 7.3 implementation note:** Introduce a dedicated core use case (e.g. `CreateChannelFulfilledOrder`) callable from a new public command method — do not overload standard `createOrder` with mutually exclusive inventory/status behavior.

**Rejected alternatives:**

- Create `NEW` channel-fulfilled orders — rejected; no merchant acknowledge step, would block sensible fulfillment state.
- Leave shipment in `CREATED` only — rejected; channel-fulfilled implies already shipped; `ShipShipment` is required for accurate `SHIPPED` status and events.
- Skip shipment entity — rejected; compatibility.md and external contract require order + shipment; shipment ledger needed for returns/merchant reads.

---

## Response semantics (OQ-7-06)

**Decision:** Use **contract-appropriate response shapes** — Channel create differs from Merchant side-effect mutations.

| Endpoint                                               | Response pattern                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant mutations (acknowledge, ship, cancel, return) | `{ Success: true, StatusCode: 201, Message: null }` — no entity body ([compatibility-acknowledge.schemas.js](../../src/modules/compatibility/presentation/compatibility-acknowledge.schemas.js))                                                                                                                                                                                                           |
| **`POST /api/v2/orders`** (Channel create)             | **Mapped external order summary** — HTTP `201` with a Channel API-aligned body containing at minimum: external status (`NEW`), `MerchantOrderNo` (Nexora `order_number`), and channel order reference (`ChannelOrderNo` / `external_order_reference`). **Omit** fabricated integer `Id` / `ChannelId` per existing identifier policy ([compatibility-matrix.md](../architecture/compatibility-matrix.md)). |
| **`POST /api/v2/orders/channel-fulfilled`**            | Same family — mapped summary including order + shipment references (e.g. merchant order number, merchant shipment number when provided). Exact fields validated against verified Channel OpenAPI during **7.2/7.3** implementation.                                                                                                                                                                        |

**Rationale:**

- Merchant mutations are side-effect acknowledgements; clients already know the order reference from the request.
- Channel **create** is the origin of truth for the channel — the client needs correlation identifiers in the response.
- Do **not** return the native `{ success, data }` v1 envelope on `/api/v2`.
- Do **not** return the Merchant `{ Success, StatusCode }` envelope for Channel create unless verified Channel OpenAPI mandates it (validate in 7.2).

---

## Idempotency and deduplication

1. **HTTP idempotency** — Required `Idempotency-Key` header on both Channel POST routes ([compatibility-idempotency.md](../architecture/compatibility-idempotency.md)). Use `PostgresIdempotencyService` with `useTransaction: true` and `routeId` set to the Nexora route (e.g. `POST /api/v2/orders`).
2. **Business deduplication** — Partial unique index `orders_tenant_channel_external_ref_unique` on `(tenant_id, channel_id, external_order_reference)` prevents duplicate channel orders. A repeat ingest with different idempotency key but same channel order reference must return the existing order (idempotent `201`), not create a duplicate.
3. **Fingerprint** — Hash the mapped **core command input**, not the raw external body (existing convention).
4. **Shipment external reference** — Channel-fulfilled shipments use the same `external_reference` uniqueness pattern as Merchant shipments (`shipments_tenant_external_reference_unique`).

---

## Event semantics (summary)

| Flow                          | Outbox events                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Native `POST /api/v1/orders`  | `order.created`, `order.confirmed`                                                                                                              |
| Channel `POST /api/v2/orders` | `order.created` only                                                                                                                            |
| Merchant acknowledge          | `order.status_changed`, `order.confirmed`                                                                                                       |
| Channel-fulfilled             | `order.created`, `order.confirmed`, `shipment.created`, `shipment.shipped`, `shipment.status_changed`, `order.status_changed` (when applicable) |

All events flow through the existing outbox → `integration-events` → webhook dispatch pipeline (Phase 6). No new queues.

External webhook delivery continues to use `PHASE_6_EXTERNAL_EVENT_ALLOWLIST` until Phase 7.5 catalog expansion.

---

## Security / authorization

| Route                                   | Permission (proposed)                                             | Notes                                                                   |
| --------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `POST /api/v2/orders`                   | `orders.ingest` (new)                                             | Separates channel ingestion from native `orders.create`                 |
| `POST /api/v2/orders/channel-fulfilled` | `orders.ingest_channel_fulfilled` (new) or shared `orders.ingest` | Decide during 7.2 — prefer distinct permission for auditable separation |
| Existing Merchant routes                | Unchanged (`orders.update`, `shipments.create`, etc.)             |

- Authentication: existing JWT bearer + API key (`authentication.plugin.js`).
- Rate limits: `COMPATIBILITY_RATE_LIMIT_POLICIES.mutation`.
- Audit: `ORDER_CREATED` via existing `auditRecorder` in create flows.
- PII: Channel create payloads include customer data — classify in webhook catalog when expanding (Phase 7.5).

**Migration note:** New permissions require migrations `0038+` in Phase 7.2 — **not** in Phase 7.0.

---

## Tenant / RLS boundaries

- All order/shipment writes run inside `database.execute(..., { tenantId })` with tenant GUC set — existing pattern.
- Channel resolution must verify the channel belongs to the authenticated tenant before create.
- Compatibility must not bypass RLS or use elevated connections.
- Infrastructure tables (`outbox_events`, `idempotency_records`) remain global maintenance scope (Phase 6.6).

---

## Compatibility / core dependency boundaries

```
POST /api/v2/orders (compatibility presentation)
        ↓ mapper
OrderCommandService.createOrder (orders/public)
        ↓
CreateOrder use case (orders/application) — extended in 7.1
        ↓
ProductQueryService, OfferQueryService, ChannelQueryService,
PricingService, InventoryService (public ports)
```

- **Forbidden:** compatibility → postgres repositories, compatibility → core `index.js`, core → compatibility.
- **Allowed:** New public query methods on `ChannelQueryService` / `OfferQueryService` only when required for resolution gaps documented above.

---

## Alternatives considered

| Alternative                                      | Rejected because                                          |
| ------------------------------------------------ | --------------------------------------------------------- |
| `/api/v2/channel/orders` namespace               | Breaks verified Channel API path parity                   |
| Native `/api/v1/orders` creates `NEW`            | Breaks ADR-017 and existing clients/tests                 |
| Defer inventory reserve to acknowledge           | Contradicts ADR-017; larger refactor                      |
| Channel-fulfilled as `NEW` + skip shipment       | Incompatible with Merchant workflow and external contract |
| Merchant `{Success}` response for Channel create | Insufficient for channel-side correlation                 |
| Separate idempotency store for compatibility     | Violates compatibility-idempotency convention             |

---

## Consequences

**Positive**

- Closes the documented `GET /api/v2/orders/new` product gap.
- Completes bidirectional integration: Channel ingest → Merchant fulfil → webhook notify.
- Reuses proven public contracts, idempotency, outbox, and RLS patterns.

**Negative**

- Two create semantics increase `CreateOrder` complexity (7.1).
- Public contract extensions needed for channel/offer external reference lookup.
- Stock location mapping requires operational configuration discipline until schema support exists.

---

## Deferred decisions

Explicitly **out of Phase 7** unless promoted during implementation:

| Item                                            | Phase                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Webhook delivery history retention              | Post-7.5 ops                                                  |
| Retry-After-aware webhook scheduling            | Post-6.6 ops                                                  |
| Worker metrics HTTP endpoint                    | Ops                                                           |
| External integer ID mapping (`Id`, `ChannelId`) | Future — continue omitting from responses                     |
| Merchant product `/api/v2/products*`            | Future Merchant wave                                          |
| Notifications (email/SMS)                       | Future phase                                                  |
| Event schema registry (OQ-032)                  | Future                                                        |
| Default stock location column on `channels`     | Only if configurationReference convention proves insufficient |
| Dedicated Tasks module                          | Not planned — interval schedulers remain                      |

---

## Implementation sequence for 7.1–7.5

| Sub-phase | Scope                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **7.1**   | Core `NEW` order creation path; public contract extensions (`initialStatus`, channel/offer lookup); inventory reserve at ingest; events |
| **7.2**   | `POST /api/v2/orders`; permissions migration; mapper; idempotency; integration tests                                                    |
| **7.3**   | `CreateChannelFulfilledOrder` use case; `POST /api/v2/orders/channel-fulfilled`; shipment auto-create + ship                            |
| **7.4**   | Merchant wave 2 (`PUT /api/v2/shipments/{merchantShipmentNo}`, return receive/acknowledge)                                              |
| **7.5**   | Webhook catalog expansion (product/inventory events)                                                                                    |

---

## Related

- [ADR-017](ADR-017-phase-4-orders-fulfillment.md) — order lifecycle, inventory reserve-on-create
- [ADR-018](ADR-018-phase-5-merchant-compatible-scope.md) — Merchant vs Channel contract separation
- [ADR-019](ADR-019-phase-6-webhooks-events.md) — event delivery pipeline
- [compatibility.md](../architecture/compatibility.md)
- [compatibility-matrix.md](../architecture/compatibility-matrix.md)
- [compatibility-idempotency.md](../architecture/compatibility-idempotency.md)
- [events.md](../architecture/events.md)
