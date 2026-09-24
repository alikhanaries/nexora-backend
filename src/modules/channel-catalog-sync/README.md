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

## Worker wiring

The worker composition root (`src/workers/bootstrap/wire-channel-catalog-sync.js`) supplies query ports and registers the enqueue inbox consumer `channel-catalog-sync.enqueue`.

No HTTP routes in this phase.

## Rate limiting

Redis GCRA policy `catalog-sync` scoped per `(tenantId, channelId)` — separate from webhooks and compatibility HTTP.

## Persistence

No Phase 16 migrations. Job coalescing uses BullMQ job IDs; inbox deduplicates event fan-out per consumer.
