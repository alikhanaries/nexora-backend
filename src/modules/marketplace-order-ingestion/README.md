# Marketplace order ingestion (Phase 28)

Generic inbound pipeline:

```text
Provider adapter (webhook / poll)
        ↓
Normalized marketplace order
        ↓
MarketplaceOrderIngestionService
        ↓
CreateChannelOrder (Orders domain)
```

## External identity

Marketplace orders dedupe on `(tenant_id, channel_id, external_order_reference)` using the normalized `externalOrderId`. Different channels never collide.

## Module entrypoints

- `createMarketplaceOrderIngestionModule` — composition root
- `MarketplaceOrderIngestionService.ingest` — accepts a validated normalized order
- `IngestNormalizedMarketplaceOrder` — optional adapter fetch + ingest

See [order-ingestion.md](../../../docs/marketplaces/order-ingestion.md).
