# ADR-028: Phase 15 Product, Inventory & Pricing Synchronization Architecture

**Status:** Accepted (specification only — no implementation in Phase 15)  
**Date:** 2026-09-24  
**Phase:** 15 — architecture / contract definition

## 1. Context

Nexora is a **provider-neutral modular monolith** ([ADR-001](ADR-001-modular-monolith.md), [platform-independence.md](../architecture/platform-independence.md)). PostgreSQL is the **system of record** for products, offers, prices, inventory, channels, and marketplaces.

Completed related phases:

| Phase | ADR | Relevant outcome |
| ----- | --- | ---------------- |
| 3 | ADR-014, ADR-015 | Pricing validity, offer lifecycle (no marketplace sync) |
| 4 | ADR-016, ADR-017 | Commerce public contracts; order reservation at create |
| 6–12 | ADR-019, ADR-025 | Outbox → BullMQ → webhook **tenant** notifications |
| 7–9 | ADR-020, ADR-022 | **Inbound** channel order ingest; `channels.default_stock_location_id` |
| 8 | ADR-021 | Integer ID mapping for **compat_v2** order/shipment entities only |
| 14 | ADR-027 | Shipment fulfillment consumes inventory at `SHIPPED`; `fulfillReservedForShipment`; channel-fulfilled uses `recordSale` |

**Phase 14 inventory lifecycle (authoritative for sync design):**

- Normal orders: `reserve` at order create → `fulfillReservedForShipment` at ship (partial OK) → reservation `RELEASED` when quantity zero.
- Channel-fulfilled: no reservation; `recordSale` at ship.
- Balances: `available = on_hand - reserved` (CHECK-enforced).

There is **no** outbound catalog synchronization code today. Integration events (`product.*`, `offer.*`, `price.*`, `inventory.*`) are emitted to the outbox and may be delivered to **tenant webhook URLs** — that is **not** marketplace API synchronization.

External Merchant/Channel **compatibility** (`/api/v2`) translates HTTP to Nexora public contracts; it does **not** call marketplace product/inventory/price APIs ([compatibility-matrix.md](../architecture/compatibility-matrix.md)).

## 2. Existing capabilities (evidence-based)

### 2.1 Capability matrix

| Capability | Existing? | Evidence | Missing for marketplace sync |
| ---------- | --------- | -------- | ------------------------------ |
| Product CRUD | **Yes** | `src/modules/products` — create/update/deactivate/archive; `/api/v1/products` | Outbound publish; inbound catalog import |
| SKU / variant management | **Partial** | One `merchantSku` per product; no variant entity | Channel listing SKU ≠ `merchantSku` (see gaps) |
| Offer management | **Yes** | `src/modules/offers` — DRAFT/ACTIVE/INACTIVE/SUSPENDED; `listingStatus` UNLISTED/LISTED/DELISTED | Sync listing state to marketplace |
| Price management | **Yes** | `src/modules/pricing` — `PricingService.getEffectivePrice`, validity windows, channel scope ([ADR-014](ADR-014-pricing-validity.md)) | Outbound price push |
| Stock locations | **Yes** | `inventory` module; `/api/v1/stock-locations` | Per-channel location mapping beyond default |
| Inventory balances | **Yes** | `inventory_balances`; `InventoryService.getAvailability` | Published quantity selection policy |
| Inventory reservation | **Yes** | ORDER reservations; HTTP + order create | N/A for outbound |
| Inventory fulfillment | **Yes** | ADR-027 `fulfillReservedForShipment` | Triggers for sync (via events) |
| Channel configuration | **Yes** | `channels.external_reference`, `default_stock_location_id`, `configurationReference` legacy ([ADR-022](ADR-022-phase-9-channel-default-stock-location.md)) | Sync enablement, credentials, adapter binding |
| Marketplace configuration | **Yes** | `marketplaces.key` (opaque string), status | No adapter registry or API client |
| External product mapping | **Partial** | `products.external_reference`, `offers.external_reference` (tenant strings) | Stable marketplace product/listing IDs; no `external_integer_id_mappings` for product |
| External SKU mapping | **No** | Order lines snapshot `merchantSku` only | Channel-specific SKU column or mapping table |
| Product outbound sync | **No** | — | Full pipeline |
| Inventory outbound sync | **No** | Events only | Consumer + adapter |
| Pricing outbound sync | **No** | Events only | Consumer + adapter |
| Product inbound sync | **No** | Channel ingest resolves **existing** SKU ([ADR-020](ADR-020-phase-7-channel-inbound-integration.md)) | Catalog import from marketplace |
| Inventory inbound sync | **No** | Receipts/adjustments via native API only | External stock feeds |
| Pricing inbound sync | **No** | — | External price import |
| Full reconciliation | **No** | — | Compare/repair jobs |
| Incremental synchronization | **No** | Outbox + webhooks for **notifications** | Marketplace push workers |
| Sync retry | **Partial** | BullMQ backoff; webhook Retry-After ([ADR-025](ADR-025-phase-12-webhook-retry-after-scheduling.md)) | Sync-specific classification + idempotency store |
| Sync idempotency | **Partial** | Inbox dedup per consumer; movement idempotency keys in inventory | Cross-attempt sync dedup |
| Per-channel rate limiting | **Partial** | Redis rate limiter ([ADR-006](ADR-006-distributed-rate-limiting.md)); compat HTTP limits | Outbound marketplace API limits |
| Sync observability | **Partial** | Phase 13 worker metrics ([ADR-026](ADR-026-phase-13-worker-observability-http.md)) | Sync attempt metrics, last-success timestamps |

### 2.2 Events already emitted (triggers)

Catalog in `src/shared/events/event-catalog.js` (externally deliverable via webhooks):

| Event | Producer | Typical sync relevance |
| ----- | -------- | ---------------------- |
| `product.created` / `updated` / `status_changed` | products | Product outbound |
| `offer.created` / `updated` / `status_changed` | offers | Listing / offer outbound |
| `price.created` / `updated` / `changed` | pricing | Price outbound |
| `inventory.inventory_changed` | inventory | Stock outbound (includes balance snapshot in payload) |
| `inventory.inventory_reserved` / `inventory_released` | inventory | Stock outbound (available changed) |
| `channel.updated` | channels | Re-resolve default stock location for inventory sync |

**No new domain events are required for Phase 15.** Implementation may add a **sync orchestration** consumer that subscribes to these types. Optional future `sync.*` events are **non-goals** until observability requirements justify them.

### 2.3 Worker / queue infrastructure

| Queue | Purpose today |
| ----- | ------------- |
| `integration-events` | Outbox publish → `CompositeIntegrationEventRouter` (logging + webhook enqueue) |
| `webhook-deliveries` | HTTPS POST to tenant subscriptions |

**No** `catalog-sync` or marketplace queue exists. [module-boundaries.md](../architecture/module-boundaries.md) mandates: **outbound via outbox → BullMQ → handler → adapter** (core must not call external APIs synchronously).

### 2.4 External ID mapping ([ADR-021](ADR-021-external-id-mapping.md))

Resource types today: `order`, `order_line`, `shipment`, `cancellation`, `return` — **not** `product`, `offer`, or `price`.

Compatibility integer IDs are for `/api/v2` **response enrichment**, not marketplace listing IDs.

## 3. Problem statement

Tenants operating sales channels need Nexora **sellable catalog state** (product/offer identity, price, stock) to appear on external marketplaces **after** changes in Nexora, with controlled retries and without compromising tenant isolation or core module boundaries.

Today:

- Core modules mutate PostgreSQL and emit integration events.
- Tenants can receive webhook notifications.
- **Nothing** pushes catalog updates to marketplace APIs or reconciles drift.

## 4. Goals

1. Define **source-of-truth** and **direction** per domain (product, inventory, price).
2. Define a **channel/marketplace adapter boundary** that keeps core modules provider-neutral.
3. Define **event → job → adapter** flow reusing outbox and BullMQ.
4. Define **idempotency, retry, rate limiting, and reconciliation** contracts.
5. Split **implementation phases** so inventory, pricing, and product sync can ship independently.
6. Preserve **compatibility** as inbound/order adapter only — not sync implementation.

## 5. Non-goals (Phase 15 and initial implementation waves)

- Implementing sync code, migrations, APIs, or workers in Phase 15.
- Inbound marketplace **catalog** import (unless a later product decision explicitly requires it).
- Bidirectional product ownership or conflict merge engines.
- ChannelEngine SDK as a core dependency.
- Changing inventory reservation/fulfillment semantics (ADR-027).
- New HTTP inventory/product routes for sync.
- Using `/api/v2` compatibility as the sync transport.
- Real-time sub-second sync SLAs.
- Multi-location inventory aggregation across channels (until product defines it).

## 6. Source-of-truth model

| Domain | Authoritative system | Direction (default) | Notes |
| ------ | -------------------- | ------------------- | ----- |
| Product master data | **Nexora** (`products`, content in object storage) | Nexora → channel | No variant table; SKU = `merchantSku` |
| Offer (product × channel) | **Nexora** (`offers`) | Nexora → channel | One offer per `(tenant, product, channel)` |
| Price | **Nexora** (`prices` + ADR-014 resolution) | Nexora → channel | Effective price from `PricingService.getEffectivePrice` at sync time |
| Inventory quantity | **Nexora** (`inventory_balances` per location) | Nexora → channel | Quantity semantics in §8 |
| Orders / fulfillment | **Nexora** (inbound via compat/channel API) | Inbound already implemented | Out of scope for catalog sync |

**Hard stop (product input required):** If a tenant requires **marketplace-authored** product or price truth, that is **out of model** until a separate ADR defines inbound catalog ownership.

## 7. Product synchronization architecture

### 7.1 Nexora → external channel

**Detection:** Subscribe to `product.created`, `product.updated`, `product.status_changed`, and (for channel listings) `offer.*` via a dedicated inbox consumer (new worker handler — future phase).

**Fields in scope (minimum viable):**

| Nexora field | Sync note |
| ------------ | --------- |
| `merchantSku` | Primary external SKU key unless offer mapping overrides |
| `productType`, `status` | Map to adapter-specific listing lifecycle |
| `externalReference` | Optional tenant-level reference; not marketplace ID |
| Product content | **Deferred** — binary/text in object storage; adapter may need separate media sync phase |

**Variants:** Not modeled. Adapters treat one Nexora product as one listing SKU unless product adds variants later.

**External product IDs:**

- Persist marketplace-assigned IDs on **`offers.external_reference`** (channel-scoped) and/or **`products.external_reference`** (tenant-scoped) — **do not** overload `compat_v2` integer mappings.
- Optional future: extend `external_integer_id_mappings` with `resource_type = product | offer` **only if** a verified contract requires integers (not required for generic adapter port).

**Create vs update:** Adapter operation determined by presence of stored marketplace ID for `(tenant, channel, product)`:

- No ID → `createListing` (or equivalent)
- ID present → `updateListing`
- `product.status_changed` / offer `INACTIVE` / `listingStatus = DELISTED` → `deactivateListing` (adapter maps semantics)

**Channel-specific transforms:** Only inside **marketplace adapter** implementation (e.g. map `STANDARD` product type). Core emits provider-neutral events.

### 7.2 External channel → Nexora (product)

**Default decision:** **Not required** for initial sync waves. Channel order ingest already resolves **existing** products by SKU ([ADR-020](ADR-020-phase-7-channel-inbound-integration.md)).

**Deferred (§25):** Auto-create products from marketplace catalog pull.

## 8. Inventory synchronization architecture

### 8.1 Published quantity (decision)

For a channel with configured stock location **`L`** (see §8.2), publish:

```text
publishQuantity = available at L = on_hand - reserved
```

**Rationale (from existing semantics):**

- Marketplaces must not sell stock already **reserved** for open Nexora orders ([ADR-013](ADR-013-inventory-concurrency.md), ADR-017, ADR-027).
- Publishing `on_hand` would oversell when `reserved > 0`.
- Publishing only fulfillment deltas would miss receipt/adjustment/reserve/release paths; `inventory.inventory_changed` and reserve/release events already carry post-mutation balances.

**Payload source:** Prefer `inventory.inventory_changed` payload `balance.available` when `stockLocationId === L`. For `inventory.inventory_reserved` / `inventory_released`, re-read via `InventoryService.getAvailability` in the sync worker if payload is insufficient.

**Hard stop (product input):** Marketplaces that mandate **`on_hand`** or **allocated** semantics different from Nexora must be handled per **adapter capability flag** — not by changing core inventory ([ADR-027](../decisions/ADR-027-phase-14-shipment-fulfillment-inventory.md) forbids allocated model).

### 8.2 Stock locations and channels

| Rule | Source |
| ---- | ------ |
| One **primary** location per channel for sync | `channels.default_stock_location_id` ([ADR-022](ADR-022-phase-9-channel-default-stock-location.md)) |
| Fallback for legacy configs | `configurationReference` UUID (deprecated path) |
| Ingest reservation location | Same as order line `stock_location_id` at create — must match channel default when not overridden |
| Multi-location aggregation | **Not supported** initially — publish single location only |
| Location change on channel | Emit `channel.updated`; sync worker **re-publishes all active offers** for that channel (full slice for that channel) — expensive; reconciliation job may batch |

**Product key for inventory sync:** `(tenantId, channelId, productId, stockLocationId)` internally; adapter maps to marketplace SKU/listing ID.

### 8.3 Events triggering inventory sync

| Event | Action |
| ----- | ------ |
| `inventory.inventory_changed` | Enqueue incremental sync when `stockLocationId` matches channel’s resolved `L` |
| `inventory.inventory_reserved` | Same (available decreased) |
| `inventory.inventory_released` | Same (available increased) |
| `offer.status_changed` → ACTIVE | Enqueue full quantity snapshot (initial publish) |
| `channel.updated` (default location) | Enqueue channel-scoped inventory resync |

**New event types:** Not required in Phase 15.

### 8.4 Reliability

See §§13–16 (retry, idempotency, ordering, stale updates, reconciliation).

## 9. Pricing synchronization architecture

### 9.1 Source of truth

- **Rows:** `prices` table with channel-specific or tenant-wide rows ([ADR-014](ADR-014-pricing-validity.md)).
- **Effective price at sync time:** `PricingService.getEffectivePrice(tenantId, productId, channelId, currency, at)`.

**Precedence (existing):** Channel-specific price beats tenant-wide; latest `valid_from` wins; tie-break lowest `id`.

### 9.2 Triggers

| Event | Action |
| ----- | ------ |
| `price.created`, `price.updated`, `price.changed` | Enqueue price sync for `(productId, channelId, currency)` |
| Offer activation | Enqueue price sync (offer may activate before first price push) |

**Amount:** Integer `amountMinor` + ISO currency — adapter converts to marketplace decimal rules (same as compatibility money mapping).

### 9.3 Stale / duplicate updates

- **Version vector (logical):** `(price.id, validFrom, amountMinor, status)` in sync job payload; adapter ignores strictly older effective windows if marketplace API supports effective dating.
- **Idempotency key:** `tenant:channel:price:productId:currency:priceRowId:validFrom` (see §15).
- **Out-of-order:** Worker serializes per `(tenant, channel, productId, currency)` via BullMQ job key or DB advisory lock.

## 10. Channel / marketplace adapter boundary

### 10.1 Layering (required)

```text
Core modules (products, offers, pricing, inventory, channels)
        ↓ public query/command ports only
Sync orchestration (new module — e.g. src/modules/channel-sync/ or integrations/)
        ↓ adapter port interface
Marketplace adapter (per marketplace.key or connector plugin)
        ↓ HTTPS / SDK isolated here
External marketplace API
```

**Compatibility module** remains **inbound/order** only — it must **not** implement catalog sync ([ADR-018](ADR-018-phase-5-merchant-compatible-scope.md), [platform-independence.md](../architecture/platform-independence.md)).

### 10.2 Adapter port (contract sketch)

```typescript
// Illustrative — implementation phase defines exact TypeScript/JSDoc in public/

interface ChannelCatalogAdapter {
  readonly marketplaceKey: string;

  publishProductListing(input: {
    tenantId: string;
    channelId: string;
    productId: string;
    offerId: string;
    merchantSku: string;
    operation: 'create' | 'update' | 'deactivate';
    attributes: Record<string, unknown>; // adapter-specific bundle from mapper
  }): Promise<{ externalListingId: string }>;

  publishInventory(input: {
    tenantId: string;
    channelId: string;
    productId: string;
    merchantSku: string;
    stockLocationId: string;
    quantity: number; // nonnegative integer — available
  }): Promise<void>;

  publishPrice(input: {
    tenantId: string;
    channelId: string;
    productId: string;
    currency: string;
    amountMinor: number;
    validFrom: string;
    validTo: string | null;
  }): Promise<void>;
}
```

**Capabilities:** Resolved at runtime from `marketplaces.key` + tenant channel configuration (future: `channel_sync_connections` or equivalent — **persistence in implementation phase**).

**Authentication:** Per-connection credentials stored **encrypted** (reuse `SecretEncryptor` pattern from webhooks/API keys — [ADR-009](ADR-009-audit-log-architecture.md) deferred audit export). **No** marketplace secrets in core config schema ([platform-independence.md](../architecture/platform-independence.md)).

**Error normalization:** Adapter maps HTTP/SDK errors to shared `SyncError` categories (§14).

## 11. Event / outbox model

1. Core transaction commits business change + `outbox_events` row (unchanged).
2. `OutboxPublisher` enqueues `integration-events` job (unchanged).
3. **New** inbox consumer: `catalog-sync.enqueue` (name TBD) reads allowed event types, resolves affected `(tenant, channel, product)` targets, enqueues **second-stage** jobs on new queue `channel-catalog-sync` (name TBD).
4. Second-stage worker loads read models via **public** `ProductQueryService`, `OfferQueryService`, `PricingService`, `InventoryService`, `ChannelQueryService`, invokes adapter.

**Why two stages:** Decouple fast event fan-out from slow/rate-limited marketplace HTTP; collapse duplicate jobs (§12).

**Webhook relationship:** Webhook delivery remains parallel; tenants may still consume the same integration events. Sync does not replace webhooks.

## 12. Worker / job model

### 12.1 Queues (proposed)

| Queue | Job | Purpose |
| ----- | --- | ------- |
| `integration-events` | (existing) | Fan-out |
| `channel-catalog-sync` | `sync-product` / `sync-inventory` / `sync-price` | Marketplace HTTP via adapter |

### 12.2 Job keys (deduplication)

| Job kind | Stable key |
| -------- | ---------- |
| Inventory | `{tenantId}:{channelId}:inventory:{productId}:{stockLocationId}` |
| Price | `{tenantId}:{channelId}:price:{productId}:{currency}` |
| Product/offer | `{tenantId}:{channelId}:listing:{offerId}` |

BullMQ `jobId` = key → coalesce bursts (multiple inventory events → one pending job). Worker always reads **latest** balance/price before HTTP call.

### 12.3 Scheduling

| Mechanism | Use |
| --------- | --- |
| Event-driven | Primary incremental path |
| Scheduled reconciliation | Nightly/weekly full diff per channel (implementation phase) |
| Manual admin trigger | Future ops API (optional) |

**Not** synchronous on HTTP request path.

## 13. Rate limiting

| Layer | Approach |
| ----- | -------- |
| Marketplace HTTP | Per-`(tenant, channel)` token bucket in Redis ([ADR-006](ADR-006-distributed-rate-limiting.md)) — **separate policy** from compatibility HTTP and webhook delivery |
| 429 + Retry-After | Mirror ADR-025 **pattern** (cap delay, `moveToDelayed`) — **separate** from webhook queue |
| Global worker concurrency | `QUEUE_WORKER_CONCURRENCY` per process; optional per-queue limit |

Webhook Retry-After infrastructure is **not** reused directly (different queue, payload, persistence table).

## 14. Retry / error handling

| Condition | Classification | Action |
| --------- | -------------- | ------ |
| Timeout / network | Retryable | BullMQ retry + backoff |
| HTTP 429 | Retryable | Honor Retry-After if present (capped) |
| HTTP 5xx | Retryable | Backoff |
| HTTP 401/403 | Non-retryable | Mark connection `SUSPENDED`; audit + alert |
| HTTP 400/422 validation | Non-retryable | Record terminal failure; operator fix |
| Duplicate success (idempotent retry) | Success | Adapter returns success or conflict-as-success |
| Response lost after external success | Retryable | Idempotency key on adapter side + stored external ID |
| Worker crash mid-flight | Retryable | At-least-once job redelivery |
| Stale job (superseded) | Benign | Worker re-reads latest state before skip/push |
| Out-of-order price jobs | Handled | Per-key serialization + effective-date check |
| Channel unavailable extended | Retryable | Backoff until max attempts → dead-letter + reconciliation |

**Dead-letter:** Sync job row marked failed with `next_attempt_at` null after max attempts; reconciliation picks up later.

## 15. Idempotency

| Layer | Mechanism |
| ----- | --------- |
| Event consumption | Inbox PK `(consumer_name, event_id)` — existing |
| Sync HTTP attempt | **`channel_sync_attempts`** table (future migration): unique `(tenant_id, channel_id, sync_kind, idempotency_key)`; stores outcome + external reference |
| Adapter | Marketplace-specific keys (SKU, listing ID) derived from Nexora IDs |

**Do not** add a generic platform-wide idempotency framework beyond this table + BullMQ job keys.

## 16. Reconciliation

### 16.1 Incremental (primary)

```text
Nexora mutation → outbox → integration-events → sync enqueue → channel-catalog-sync → adapter → marketplace
```

### 16.2 Full reconciliation (secondary)

```text
Scheduled job → for each (tenant, channel) with sync enabled:
  load ACTIVE offers + default stock location
  for each offer: compare Nexora (price, available) vs marketplace read API (if adapter supports getListing)
  enqueue repair jobs for mismatches
```

**Authoritative:** Nexora wins on conflict unless product defines otherwise (§25).

**Large catalogs:** Paginate offers; checkpoint cursor in job state.

**Observability:** Reconciliation run summary per channel (counts matched/fixed/failed) — metrics, not audit (§18).

## 17. Multi-tenancy and security

- All sync jobs carry `tenantId`; database work uses tenant-scoped transactions (`app.current_tenant_id()`).
- Workers set tenant GUC before loading channel/product data.
- **No** cross-tenant batch queries without tenant filter.
- Channel credentials encrypted at rest; decryption only in worker adapter layer.
- Authorization: sync configuration mutations require new permissions (e.g. `channels.sync_manage`) — **implementation phase**; native `/api/v1` only.
- RLS on any new sync tables: `tenant_id` policy matching existing modules.

## 18. Observability

Reuse Phase 13 worker HTTP metrics ([ADR-026](ADR-026-phase-13-worker-observability-http.md)) with **low-cardinality** labels:

| Metric (examples) | Labels |
| ----------------- | ------ |
| `channel_sync_attempts_total` | `result`, `sync_kind` |
| `channel_sync_duration_seconds` | `sync_kind` |
| `channel_sync_queue_depth` | `queue` |

**Per-channel last success timestamp:** Store on `channel_sync_state` row (future table), expose via admin read API later — not high-cardinality metric.

Structured logs: `tenantId`, `channelId`, `productId`, `syncKind`, `attemptId`, `correlationId` from originating event.

## 19. Audit

| Action | Audit? |
| ------ | ------ |
| Tenant changes sync connection / credentials | **Yes** — `CHANNEL_SYNC_CONNECTION_UPDATED` |
| Automatic sync attempt | **No** — metrics + `channel_sync_attempts` |
| Reconciliation repair | **Yes** — summary event per run |
| Core product/price/inventory mutation | Existing module audit (where present) |

## 20. API impact (future implementation)

| Surface | Change |
| ------- | ------ |
| `/api/v1` | Optional: channel sync connection CRUD, manual resync trigger, read sync status |
| `/api/v2` | **None** — compatibility unchanged |
| Webhooks | **None required** — existing catalog events remain valid |

## 21. Persistence impact (future implementation)

Expected new artifacts (single migration wave or split):

| Artifact | Purpose |
| -------- | ------- |
| `channel_sync_connections` | Encrypted credentials, marketplace key, status, channel FK |
| `channel_sync_state` | Last success per `(channel, sync_kind, product?)` |
| `channel_sync_attempts` | Idempotency + failure history |

**No change** to `inventory_balances`, `products`, `prices`, `offers` schemas for MVP sync (use existing `external_reference` fields).

Optional later: `external_integer_id_mappings.resource_type = product | offer`.

## 22. Migration requirements

**Phase 15:** None.

**Implementation:** At least one migration for sync tables above before workers run. No inventory/product schema change required for MVP.

## 23. Implementation phases (recommended split)

Phase 15 delivers **this ADR only**. Do **not** combine product, inventory, and pricing in one implementation PR.

| Phase | Scope | Rationale |
| ----- | ----- | --------- |
| **16 — Sync foundation** | New module; adapter port; connection storage; `channel-catalog-sync` queue; enqueue handler on `integration-events`; metrics skeleton | Shared infrastructure |
| **17 — Inventory outbound sync** | Incremental + job coalescing; publish `available` at default stock location; first reference adapter (stub or one marketplace) | Highest operational value; events already rich |
| **18 — Pricing outbound sync** | Price events → adapter; currency/effective dating | Smaller surface than product content |
| **19 — Product/offer outbound sync** | Listing create/update/deactivate; persist marketplace IDs on `offer.external_reference` | Depends on adapter listing APIs + §25 SKU decisions |
| **20 — Reconciliation** | Scheduled compare/repair | Depends on adapter read APIs |

Channels without `default_stock_location_id` (and no legacy UUID) **skip inventory sync** with logged reason until configured.

## 24. Acceptance criteria (for implementation phases)

1. Core modules remain free of marketplace SDK imports (`arch:check`).
2. Sync path uses outbox → inbox consumer → second queue → adapter only.
3. Inventory publish uses **`available`** at channel default stock location unless adapter declares alternate capability with product sign-off.
4. Reserved stock is never published as sellable.
5. Duplicate integration events do not cause duplicate marketplace listings (idempotency table + job keys).
6. 429/5xx retry; 401/422 terminal with auditable connection state.
7. Tenant A cannot enqueue sync for tenant B channels.
8. Compatibility `/api/v2` behavior unchanged in regression tests.
9. Phase 14 fulfillment tests remain green (no inventory semantic change).
10. Observability exposes attempt counts and queue depth without per-SKU metric labels.

## 25. Deferred product decisions

| ID | Question | Why blocked |
| -- | -------- | ----------- |
| D-15-01 | First marketplace adapter target (`marketplaces.key` value) | Implementation prioritization |
| D-15-02 | Inbound catalog sync (marketplace → Nexora product create) | No current product requirement |
| D-15-03 | Channel-specific SKU distinct from `merchantSku` | Schema/API impact |
| D-15-04 | Multi-location inventory aggregation per channel | No data model |
| D-15-05 | Product media/content sync scope | Object storage + adapter complexity |
| D-15-06 | Publish quantity override for specific marketplaces (`on_hand` vs `available`) | Marketplace contract variance |
| D-15-07 | Integer external IDs for products in `/api/v2` | Not in ADR-021 resource types |

## 26. Risks and trade-offs

| Risk | Mitigation |
| ---- | ---------- |
| Event storm after bulk import | Job coalescing + rate limits |
| Offer ACTIVE before marketplace listing exists | Ordered sync: product → price → inventory (configurable dependency) |
| `configurationReference` vs `defaultStockLocationId` drift | Prefer FK field; document migration |
| Adapter failure blocks neither core TX nor webhooks | Async second queue |
| Reconciliation cost on large catalogs | Checkpointed batch jobs |

## Related

- [ADR-013](ADR-013-inventory-concurrency.md), [ADR-027](ADR-027-phase-14-shipment-fulfillment-inventory.md)
- [ADR-014](ADR-014-pricing-validity.md), [ADR-015](ADR-015-offer-lifecycle.md)
- [ADR-019](ADR-019-phase-6-webhooks-events.md), [ADR-020](ADR-020-phase-7-channel-inbound-integration.md), [ADR-022](ADR-022-phase-9-channel-default-stock-location.md)
- [module-boundaries.md](../architecture/module-boundaries.md), [events.md](../architecture/events.md)
- [src/modules/inventory/README.md](../../src/modules/inventory/README.md)
