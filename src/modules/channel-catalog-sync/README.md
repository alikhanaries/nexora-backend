# Channel Catalog Sync (Phase 16 foundation)

Shared infrastructure for **Nexora → marketplace** catalog synchronization ([ADR-028](../../docs/decisions/ADR-028-phase-15-catalog-sync-architecture.md)).

## Pipeline

```text
Domain mutation → outbox → integration-events → CatalogSyncEnqueueHandler (inbox)
    → channel-catalog-sync queue → ExecuteCatalogSyncJob → MarketplaceCatalogAdapter
```

Core commerce modules are unchanged. This module consumes existing integration event types only.

## Public contract

`ChannelCatalogSyncService` (via `createChannelCatalogSyncModule`):

- `enqueueFromIntegrationEvent(event)` — plan jobs and enqueue with deterministic BullMQ `jobId`
- `processSyncJob(payload)` — validate, tenant scope, rate limit, resolve adapter

## Adapter boundary

Implement `MarketplaceCatalogAdapter` and register on `MarketplaceCatalogAdapterRegistry` by `marketplaces.key`.

Phase 16 ships **`nexora-foundation-stub`** only (no HTTP). Other keys fail with `UnsupportedMarketplaceAdapterError` (non-retrying).

## Inventory synchronization (Phase 17)

Inventory jobs (`target = inventory` or `channel_inventory_resync`) run through `SyncChannelInventory`:

1. Resolve the channel stock location (`defaultStockLocationId`, else legacy `configurationReference` UUID — ADR-022).
2. Load an **active offer** for `(product, channel)`; **`offers.externalReference`** is the marketplace catalog identifier (required).
3. Read **authoritative** `available` quantity via public `InventoryService.getAvailability` at the resolved location (`on_hand - reserved`).
4. Call `MarketplaceCatalogAdapter.syncInventory` with absolute quantity (idempotent; no increment/decrement semantics).

Jobs coalesce per `(tenant, channel, product)`; execution always re-reads current inventory so older queued events cannot publish stale quantities.

No real marketplace HTTP adapter exists in the repository yet — the foundation stub implements `syncInventory` as a no-op. A future adapter registers on `marketplaces.key` and maps `externalCatalogIdentifier` + `availableQuantity` to the marketplace API inside the adapter only.

## Pricing synchronization (Phase 18)

Price jobs (`target = price`) run through `SyncChannelPrice`:

1. Require `currency` on the job payload (coalesced per tenant, channel, product, currency).
2. Load an active offer; **`offers.externalReference`** is the marketplace catalog identifier.
3. Read **authoritative** effective price via `PricingService.getEffectivePrice` at execution time.
4. Call `MarketplaceCatalogAdapter.syncPrice` with `amountMinor`, currency, and validity window.

Triggers: `price.created` / `price.updated` / `price.changed` (channel-scoped rows only), and `offer.status_changed` → `ACTIVE` (one job per listed currency on that offer’s channel).

## Product and offer synchronization (Phase 19)

| Event | Jobs |
| ----- | ---- |
| `product.created` / `product.updated` | `target = product` per offer channel (`entityId = productId`, `operation = sync`) |
| `product.status_changed` | `operation = deactivate` when status is not `ACTIVE` |
| `offer.created` / `offer.updated` | `target = offer` (`entityId = offerId`) |
| `offer.status_changed` → `ACTIVE` | `offer` + `activate` and Phase 18 price jobs |
| `offer.status_changed` → `INACTIVE` / `SUSPENDED` | `offer` + `deactivate` |

Execution reads current `ProductQueryService` / `OfferQueryService` state. Marketplace listing identity uses **`offers.externalReference`** (required except explicit deactivate). Optional `products.externalReference` is passed as tenant product reference only.

Adapter methods: `syncProduct`, `syncOffer` (foundation stub no-op). No product content/media sync in this phase.

## Worker wiring

The worker composition root (`src/workers/bootstrap/wire-channel-catalog-sync.js`) supplies query ports and registers the enqueue inbox consumer `channel-catalog-sync.enqueue`.

No HTTP routes in this phase.

## Rate limiting

Redis GCRA policy `catalog-sync` scoped per `(tenantId, channelId)` — separate from webhooks and compatibility HTTP.

## Reconciliation (Phase 20)

Secondary **scheduled** path (ADR-028 §16.2). Does not replace integration-event enqueue; it sweeps eligible catalog rows and enqueues the same `channel-catalog-sync` jobs.

```text
Worker scheduler (optional) → CatalogSyncReconciliationService
  → plan jobs per active offer on active channel
  → CatalogSyncEnqueueService.enqueuePlannedJobs (deterministic BullMQ jobId)
  → existing ExecuteCatalogSyncJob handlers (read current state at execution)
```

| Resource | Reconciliation behavior |
| -------- | ------------------------ |
| Product | `target = product`, `operation = sync` |
| Offer | `target = offer`, `operation = sync` |
| Inventory | When channel stock location resolves (ADR-022) |
| Price | One job per listed currency on the offer channel |

**Eligibility:** tenant-scoped queries (RLS via `database.execute`), **ACTIVE** channels only, **ACTIVE** offers only. Offers without `externalReference` are **skipped** at plan time (same permanent-skip semantics as sync handlers). No marketplace HTTP in the scheduler.

**Batching:** checkpointed scan across tenants → channels → offers (`listOffersPage` keyset). Limits per tick: `CATALOG_SYNC_RECONCILIATION_OFFER_BATCH_SIZE`, `CATALOG_SYNC_RECONCILIATION_MAX_JOBS_PER_TICK`.

**Coalescing:** identical `buildCatalogSyncJobId` as the event-driven path; reconciliation and events share one queue and one rate limiter (`catalog-sync`).

**Configuration:** disabled by default (`CATALOG_SYNC_RECONCILIATION_ENABLED=false`). Interval and batch env vars validated in `config/schema.js`.

**Metrics:** `channel_catalog_reconciliation_runs_total`, `channel_catalog_reconciliation_jobs_total` (planned / skipped), duration histogram.

**Deferred:** marketplace read/compare APIs, `channel_sync_state` / `channel_sync_attempts` tables, inbound drift repair, media/content sync.

## Persistence

No Phase 16 migrations. Job coalescing uses BullMQ job IDs; inbox deduplicates event fan-out per consumer. Reconciliation checkpoint state is in-process only (resumes across ticks on the same worker instance).
