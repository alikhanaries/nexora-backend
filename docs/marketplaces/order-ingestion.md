# Marketplace order ingestion architecture (Phase 28)

## Flow

```text
Marketplace API / Webhook (future)
        ↓
Provider order adapter (future per provider)
        ↓
Normalized marketplace order
        ↓
MarketplaceOrderIngestionService
        ↓
CreateChannelOrder → Orders tables + outbox (order.created)
```

Core Orders remain marketplace-agnostic. Provider logic stays in adapters; ingestion is generic.

## Normalized contract

Defined in `normalized-marketplace-order.schema.js`. Derived from existing channel ingest (`CreateChannelOrder`):

| Field | Purpose |
| ----- | ------- |
| `externalOrderId` | Canonical dedup key → `orders.external_order_reference` |
| `externalOrderNumber` | Optional display reference (not used for dedup) |
| `marketplaceKey` | Must match channel marketplace |
| `status` | Provider-neutral; only `pending` / `confirmed` / `unknown` ingest in Phase 28 |
| `currency`, totals | Maps to order money columns |
| `customer` | Immutable `CustomerSnapshot` |
| `lines` | SKU / offer / marketplace entity mapping resolution |

Line prices from the marketplace are informational; Nexora effective pricing applies at ingest (same as Channel API).

## Idempotency

- **Database:** unique index `orders_tenant_channel_external_ref_unique`
- **Application:** `CreateChannelOrder` equivalence check on replay
- **Concurrency:** insert race → unique violation → load existing row

Duplicate delivery returns `ingestionOutcome: duplicate` without a second order row.

## SKU resolution

1. `merchantSku` → tenant product SKU  
2. `channelProductNo` → offer external reference  
3. `marketplaceExternalEntity` → `marketplace_entity_mappings` (catalog sync mappings)

Missing mapping → permanent failure (`NotFoundError`), not silent wrong product association.

## Adapter contract

`MarketplaceOrderAdapter` (`marketplace-order-adapter.port.js`):

- `getOrderCapabilities()` — `supportsOrdersInbound`, webhook/poll flags  
- `fetchOrder` / `normalizeWebhookOrder` — provider-specific (not implemented for Shopify/Amazon/Noon/Namshi in Phase 28)

Webhook and polling workers should call `IngestNormalizedMarketplaceOrder` with either a normalized payload or `externalOrderId` + adapter fetch.

## Observability

Metric `marketplace_order_ingestion_total` labels: `outcome`, `marketplace`, `operation`. No PII or order IDs in labels.

## Deferred (provider phases)

- Verified provider order APIs and adapters  
- Inbound webhook routes and signature verification  
- Order update / cancel / fulfillment sync  
- Polling schedules and cursors  
