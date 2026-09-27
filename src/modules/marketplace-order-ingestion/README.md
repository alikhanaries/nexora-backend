# Marketplace order ingestion (Phase 28+) and lifecycle (Phase 31)

Generic inbound create pipeline:

```text
Provider adapter (webhook / poll)
        ↓
Normalized marketplace order
        ↓
MarketplaceOrderIngestionService
        ↓
CreateChannelOrder (Orders domain)
```

Generic inbound **lifecycle** pipeline (Phase 31 — no provider HTTP in core):

```text
Provider adapter (webhook / poll — future)
        ↓
Normalized lifecycle command
        ↓
MarketplaceOrderLifecycleService
        ↓
Orders / cancellations / returns / shipments (existing domain services)
```

## External identity

Marketplace orders dedupe on `(tenant_id, channel_id, external_order_reference)` using the normalized `externalOrderId`. Different channels never collide.

## Module entrypoints

- `createMarketplaceOrderIngestionModule` — composition root
- `MarketplaceOrderIngestionService.ingest` — accepts a validated normalized order
- `IngestNormalizedMarketplaceOrder` — optional adapter fetch + ingest

See [order-ingestion.md](../../../docs/marketplaces/order-ingestion.md).
